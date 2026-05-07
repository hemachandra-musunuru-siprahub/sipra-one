// ─── Centralized Role Helpers ───────────────────────────────────────────────
// Microsoft Entra ID is the single source of truth for all roles.
// Roles are read ONLY from the JWT session token (req.user.roles).
// Priority: Admin > HR > Manager > Employee (default).
// The database stores NO role information.

export const ADMIN_ROLES = ["Admin", "SipraHub-SystemAdmin", "SipraHub_Admin"] as const;
export const HR_ROLES = ["HR", "SipraHub-HR", "SipraHub_HR"] as const;
export const MANAGER_ROLES = ["Manager", "SipraHub-Manager", "SipraHub_Manager"] as const;
export const EMPLOYEE_ROLES = ["Employee", "SipraHub-Employee", "SipraHub_Employee", "Default Access"] as const;

export const isAdmin = (roles: string | string[]): boolean => {
  const r = Array.isArray(roles) ? roles : [roles];
  return ADMIN_ROLES.some(val => r.includes(val));
};
export const isHR = (roles: string | string[]): boolean => {
  const r = Array.isArray(roles) ? roles : [roles];
  return HR_ROLES.some(val => r.includes(val));
};
export const isManager = (roles: string | string[]): boolean => {
  const r = Array.isArray(roles) ? roles : [roles];
  return MANAGER_ROLES.some(val => r.includes(val));
};
export const isEmployee = (roles: string | string[]): boolean => {
  const r = Array.isArray(roles) ? roles : [roles];
  return EMPLOYEE_ROLES.some(val => r.includes(val));
};

// Admin bypasses all role checks
export const canAccess = (roles: string | string[], check: (r: string | string[]) => boolean): boolean =>
  isAdmin(roles) || check(roles);

/**
 * Derive a single canonical role string from Entra JWT roles.
 * Priority: Admin > HR > Manager > Employee (default fallback).
 * This is computed at runtime — never stored in the database.
 */
export const getEffectiveRole = (roles: string[]): "admin" | "hr" | "manager" | "employee" => {
  console.log("[ROLE DEBUG] roles received in getEffectiveRole:", roles);

  if (isAdmin(roles)) {
    console.log("[ROLE DEBUG] matched role: admin");
    return "admin";
  }

  if (isHR(roles)) {
    console.log("[ROLE DEBUG] matched role: hr");
    return "hr";
  }

  if (isManager(roles)) {
    console.log("[ROLE DEBUG] matched role: manager");
    return "manager";
  }

  console.log("[ROLE DEBUG] no admin/hr/manager role matched. fallback: employee");
  return "employee";
};

// Combined role arrays for use with requireRole middleware
export const ADMIN_AND_HR_ROLES = [...ADMIN_ROLES, ...HR_ROLES];
export const ADMIN_AND_MANAGER_ROLES = [...ADMIN_ROLES, ...MANAGER_ROLES];
export const ALL_BUSINESS_ROLES = [...ADMIN_ROLES, ...HR_ROLES, ...MANAGER_ROLES, ...EMPLOYEE_ROLES];

/**
 * Derives the canonical database role string from Entra claims.
 * Used during user upsert (sync) to persist the highest privilege role.
 */
export const seedRoleFromEntraClaims = (roles: string[]): string => {
  if (isAdmin(roles)) return "Admin";
  if (isHR(roles)) return "HR";
  if (isManager(roles)) return "Manager";
  return "Employee";
};

