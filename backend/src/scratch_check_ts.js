const { query } = require("./db");

async function run() {
  try {
    const res = await query(`
      SELECT te.work_date, te.hours, te.project_name, te.task_description, tw.week_start_date
      FROM timesheet_entries te
      JOIN timesheet_weeks tw ON tw.id = te.timesheet_week_id
      JOIN users u ON u.entra_oid = tw.employee_oid
      WHERE u.email = 'hemachandra.musunuru@siprahub.com'
        AND tw.week_start_date = '2026-04-20'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();
