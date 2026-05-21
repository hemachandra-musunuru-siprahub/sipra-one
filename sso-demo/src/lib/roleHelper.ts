export type UserRole = "Admin" | "HR" | "Manager" | "Employee";

export const normalizeRole = (role?: string): UserRole => {
  if (!role) return "Employee";
  const r = role.toLowerCase().trim();
  if (r === "admin" || r.includes("admin")) return "Admin";
  if (r === "hr" || r.includes("hr")) return "HR";
  if (r === "manager" || r.includes("manager")) return "Manager";
  return "Employee";
};

export const canViewArchives = (role?: string): boolean => {
  const norm = normalizeRole(role);
  return norm === "Admin" || norm === "HR";
};

export const canViewDrafts = (role?: string): boolean => {
  const norm = normalizeRole(role);
  return norm === "Admin" || norm === "HR";
};

export const canManageAnnouncements = (role?: string): boolean => {
  const norm = normalizeRole(role);
  return norm === "Admin" || norm === "HR";
};
