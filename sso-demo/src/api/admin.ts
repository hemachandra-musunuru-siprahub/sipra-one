const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export async function getGroupedUsers() {
  const res = await fetch(`${API}/api/admin/users/grouped-by-role`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch grouped users");
  return res.json();
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
