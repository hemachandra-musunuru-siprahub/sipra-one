const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

/**
 * Fetch all users (flat list). Roles are managed by Entra ID — not stored in DB.
 * Returns: { users: User[] }
 */
export async function getAllUsers() {
  const res = await fetch(`${API}/api/admin/users`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json() as Promise<{ users: any[] }>;
}

/**
 * @deprecated Use getAllUsers() instead.
 * Kept for backwards compatibility — now returns { users: [...] } (flat, not grouped).
 */
export async function getGroupedUsers() {
  return getAllUsers();
}

export async function deleteUser(oid: string) {
  const res = await fetch(`${API}/api/admin/users/${oid}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.details || "Failed to delete user");
  }
  return res.json();
}
