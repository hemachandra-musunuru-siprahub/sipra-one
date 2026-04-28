// ─── Centralized Role Helpers ───────────────────────────────────────────────
// Supports both short names (Admin, HR, Manager, Employee) and
// Entra app role names (SipraHub-SystemAdmin, SipraHub-HR, etc.)

export const ADMIN_ROLES    = ["Admin", "SipraHub-SystemAdmin"] as const;
export const HR_ROLES       = ["HR", "SipraHub-HR"] as const;
export const MANAGER_ROLES  = ["Manager", "SipraHub-Manager"] as const;
export const EMPLOYEE_ROLES = ["Employee", "SipraHub-Employee", "Default Access"] as const;

export const isAdmin   = (roles: string[]): boolean => ADMIN_ROLES.some(r => roles.includes(r));
export const isHR      = (roles: string[]): boolean => HR_ROLES.some(r => roles.includes(r));
export const isManager = (roles: string[]): boolean => MANAGER_ROLES.some(r => roles.includes(r));
export const isEmployee= (roles: string[]): boolean => EMPLOYEE_ROLES.some(r => roles.includes(r));

// Admin bypasses all role checks
export const canAccess = (roles: string[], check: (r: string[]) => boolean): boolean =>
  isAdmin(roles) || check(roles);

// Combined role arrays for use with requireRole middleware
export const ADMIN_AND_HR_ROLES      = [...ADMIN_ROLES, ...HR_ROLES];
export const ADMIN_AND_MANAGER_ROLES = [...ADMIN_ROLES, ...MANAGER_ROLES];
export const ALL_BUSINESS_ROLES      = [...ADMIN_ROLES, ...HR_ROLES, ...MANAGER_ROLES, ...EMPLOYEE_ROLES];
