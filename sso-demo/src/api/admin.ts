const API = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Flat list of all users with Entra-synced roles */
export async function getAllUsers() {
  const res = await fetch(`${API}/api/admin/users`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch admin users");
  return res.json(); // { users: [...] }
}

/** Grouped users by Entra-synced role (for the Admin Dashboard overview) */
export async function getGroupedUsers() {
  const res = await fetch(`${API}/api/admin/users/grouped-by-role`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch grouped users");
  return res.json(); // { groups: {...}, users: [...] }
}

// NOTE: updateUserRole() has been intentionally removed.
// Roles are managed exclusively by Microsoft Entra ID and are read-only in SipraHub.

export async function deleteUser(oid: string) {
  const res = await fetch(`${API}/api/admin/users/${oid}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.details || "Failed to delete user");
  }
  return res.json();
}

export async function getTimesheetReminderSettings() {
  const res = await fetch(`${API}/api/admin/settings/timesheet-reminders`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch timesheet reminder settings");
  return res.json(); // { settings: { friday_enabled, friday_time, monday_enabled, monday_time } }
}

export async function updateTimesheetReminderSettings(settings: {
  friday_enabled: boolean;
  friday_time: string;
  monday_enabled: boolean;
  monday_time: string;
}) {
  const res = await fetch(`${API}/api/admin/settings/timesheet-reminders`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.details || "Failed to update timesheet reminder settings");
  }
  return res.json();
}

export async function triggerTimesheetReminder(type: "friday" | "monday") {
  const res = await fetch(`${API}/api/admin/settings/timesheet-reminders/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.details || "Failed to trigger timesheet reminders");
  }
  return res.json();
}

export async function updateEmployeeDOJ(oid: string, date_of_joining: string) {
  const res = await fetch(`${API}/api/admin/users/${oid}/doj`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date_of_joining }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.details || "Failed to update Date of Joining");
  }
  return res.json();
}

