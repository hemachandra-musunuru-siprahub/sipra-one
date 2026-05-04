export type UserRole = "Admin" | "HR" | "Manager" | "Employee";

export const normalizeRole = (role?: string): UserRole => {
  if (!role) return "Employee";
  const r = role.toLowerCase();
  if (r === "admin") return "Admin";
  if (r === "hr") return "HR";
  if (r === "manager") return "Manager";
  return "Employee";
};
