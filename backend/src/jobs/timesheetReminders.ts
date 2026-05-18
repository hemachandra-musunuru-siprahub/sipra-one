import cron, { ScheduledTask } from "node-cron";
import { query } from "../db";
import { createNotification } from "../services/notifications/repo";

interface ReminderSettings {
  friday_enabled: boolean;
  friday_time: string; // e.g. "15:00"
  monday_enabled: boolean;
  monday_time: string; // e.g. "09:00"
}

let fridayTask: ScheduledTask | null = null;
let mondayTask: ScheduledTask | null = null;

// Helpers to get Monday dates in YYYY-MM-DD
export function getMondayOfCurrentWeek(date: Date = new Date()): string {
  const day = date.getDay();
  // Adjust when day is Sunday (0) to get previous Monday
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split("T")[0];
}

export function getMondayOfPreviousWeek(date: Date = new Date()): string {
  const currentMonday = new Date(getMondayOfCurrentWeek(date));
  currentMonday.setDate(currentMonday.getDate() - 7);
  return currentMonday.toISOString().split("T")[0];
}

function timeToCron(timeStr: string, dayOfWeek: number): string {
  const [hour, minute] = timeStr.split(":").map(Number);
  const h = isNaN(hour) ? 9 : hour;
  const m = isNaN(minute) ? 0 : minute;
  return `${m} ${h} * * ${dayOfWeek}`;
}

// Loads settings from DB, falling back to defaults if not present
async function getSettings(): Promise<ReminderSettings> {
  try {
    const { rows } = await query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'timesheet_reminders'`
    );
    if (rows.length > 0) {
      return rows[0].setting_value;
    }
  } catch (err) {
    console.error("[TIMESHEET REMINDERS] Error loading settings, using defaults:", err);
  }
  return {
    friday_enabled: true,
    friday_time: "15:00",
    monday_enabled: true,
    monday_time: "09:00",
  };
}

// ─── BACKGROUND JOBS DEFINITION ────────────────────────────────────────────────

// Friday Reminder: Run on Friday afternoon for unsubmitted timesheets of the CURRENT week
export async function runFridayReminder() {
  console.log("[TIMESHEET JOB] Running Friday unsubmitted timesheet reminders...");
  const currentWeekMonday = getMondayOfCurrentWeek();

  try {
    // Find active employees (not Admins) who don't have a submitted/reviewed timesheet for the current week
    const { rows: missingEmployees } = await query(`
      SELECT entra_oid, name, email
      FROM users
      WHERE is_active = true 
        AND role != 'Admin'
        AND NOT EXISTS (
          SELECT 1 
          FROM timesheet_weeks tw 
          WHERE tw.employee_oid = users.entra_oid 
            AND tw.week_start_date = $1 
            AND tw.status IN ('submitted', 'reviewed')
        )
    `, [currentWeekMonday]);

    console.log(`[TIMESHEET JOB] Found ${missingEmployees.length} employees with unsubmitted timesheets for week ${currentWeekMonday}`);

    for (const emp of missingEmployees) {
      await createNotification(
        emp.entra_oid,
        "timesheet_reminder",
        "Action Required: Submit Your Timesheet for This Week",
        `Don't forget to log your hours and submit your timesheet for the week of ${currentWeekMonday} before the end of the day.`
      );
    }
  } catch (err) {
    console.error("[TIMESHEET JOB] Error in Friday reminder:", err);
  }
}

// Monday Reminder: Run on Monday morning for overdue timesheets of the PREVIOUS week
// Also aggregates missing timesheets and alerts managers.
export async function runMondayReminder() {
  console.log("[TIMESHEET JOB] Running Monday overdue timesheet reminders and manager summaries...");
  const previousWeekMonday = getMondayOfPreviousWeek();

  try {
    // Find active employees (not Admins) who don't have a submitted/reviewed timesheet for the previous week
    const { rows: overdueEmployees } = await query(`
      SELECT entra_oid, name, email, manager_entra_oid
      FROM users
      WHERE is_active = true 
        AND role != 'Admin'
        AND NOT EXISTS (
          SELECT 1 
          FROM timesheet_weeks tw 
          WHERE tw.employee_oid = users.entra_oid 
            AND tw.week_start_date = $1 
            AND tw.status IN ('submitted', 'reviewed')
        )
    `, [previousWeekMonday]);

    console.log(`[TIMESHEET JOB] Found ${overdueEmployees.length} employees with overdue timesheets for week ${previousWeekMonday}`);

    // 1. Notify Employees
    for (const emp of overdueEmployees) {
      await createNotification(
        emp.entra_oid,
        "timesheet_reminder",
        "Overdue Timesheet Reminder",
        `Your timesheet for last week (starting ${previousWeekMonday}) is now overdue. Please submit it immediately.`
      );
    }

    // 2. Notify Managers with summaries of their team members who are missing timesheets
    const managerGroups: Record<string, typeof overdueEmployees> = {};
    for (const emp of overdueEmployees) {
      if (emp.manager_entra_oid) {
        if (!managerGroups[emp.manager_entra_oid]) {
          managerGroups[emp.manager_entra_oid] = [];
        }
        managerGroups[emp.manager_entra_oid].push(emp);
      }
    }

    for (const [managerOid, team] of Object.entries(managerGroups)) {
      const namesList = team.map(t => t.name).join(", ");
      await createNotification(
        managerOid,
        "timesheet_manager_summary",
        "Action Required: Overdue Timesheets Summary",
        `The following members of your team have not submitted their timesheets for the week starting ${previousWeekMonday}: ${namesList}`
      );
    }
  } catch (err) {
    console.error("[TIMESHEET JOB] Error in Monday reminder:", err);
  }
}

// ─── INITIALIZATION AND RESCHEDULING ───────────────────────────────────────────

export async function initTimesheetJobs() {
  const settings = await getSettings();

  // Stop old jobs if they exist
  if (fridayTask) {
    fridayTask.stop();
    fridayTask = null;
  }
  if (mondayTask) {
    mondayTask.stop();
    mondayTask = null;
  }

  // Schedule Friday task if enabled
  if (settings.friday_enabled) {
    const fridayCron = timeToCron(settings.friday_time, 5);
    console.log(`[TIMESHEET JOB] Scheduling Friday reminder at cron expression: "${fridayCron}"`);
    fridayTask = cron.schedule(fridayCron, () => {
      runFridayReminder().catch(console.error);
    });
  }

  // Schedule Monday task if enabled
  if (settings.monday_enabled) {
    const mondayCron = timeToCron(settings.monday_time, 1);
    console.log(`[TIMESHEET JOB] Scheduling Monday reminder at cron expression: "${mondayCron}"`);
    mondayTask = cron.schedule(mondayCron, () => {
      runMondayReminder().catch(console.error);
    });
  }
}
