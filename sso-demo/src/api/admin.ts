const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

/** Flat list of all users with roleFromEntra resolved from Microsoft Graph */
export async function getAdminUsers() {
  const res = await fetch(`${API}/api/admin/users`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch admin users");
  return res.json(); // { users: [...] }
}

/** Grouped users (for the Admin Dashboard overview) */
export async function getGroupedUsers() {
  return getAllUsers();
}

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
