const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

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
