# Users Service Spec

## Purpose

Own user directory reads, role assignment, manager assignment, and account activation state.

## Owns

- list users
- view user profiles with field restrictions
- change roles
- activate or deactivate users
- set or clear manager mapping

## Does Not Own

- login
- session issuance
- first-login sync
- announcements permissions
- HR document permissions

## Routes

- `GET /api/users`
- `GET /api/users/:id`
- `PATCH /api/users/:id/role`
- `PATCH /api/users/:id/active`
- `PATCH /api/users/:id/manager`

## Public Interface

```ts
export type AppRole = "employee" | "manager" | "hr_admin" | "system_admin";

export type UserProfile = {
  id: string;
  entraOid: string;
  email: string;
  name: string;
  jobTitle?: string | null;
  department?: string | null;
  managerId?: string | null;
  role: AppRole;
  isActive: boolean;
};

export async function listUsers(actorId: string): Promise<UserProfile[]>;
export async function getUserById(id: string, actorId: string): Promise<UserProfile>;
export async function updateUserRole(id: string, role: AppRole, actorId: string): Promise<UserProfile>;
export async function updateUserActiveState(id: string, isActive: boolean, actorId: string): Promise<UserProfile>;
export async function updateUserManager(id: string, managerId: string | null, actorId: string): Promise<UserProfile>;
export async function getDirectReportIds(managerId: string): Promise<string[]>;
```

## Data Owned

- `users`

## Domain Rules

- `system_admin` owns role changes.
- `system_admin` owns activation changes.
- `system_admin` owns manager assignment changes and fixes.
- A `system_admin` cannot demote themselves from `system_admin`.
- A `system_admin` cannot deactivate themselves.
- Role values are limited to:
  - `employee`
  - `manager`
  - `hr_admin`
  - `system_admin`
- List and detail views must apply field restrictions for non-admin users.

## Authorization Rules

| Operation | Role |
|---|---|
| List all users | `system_admin` only |
| Read limited user profile | authenticated user |
| Read full user profile | `system_admin` only |
| Change role | `system_admin` only |
| Change active state | `system_admin` only |
| Change manager assignment | `system_admin` only |

## File Skeleton

```text
services/users/
  src/
    public.ts
    routes.ts
    service.ts
    repo.ts
    schema.ts
    types.ts
    authz.ts
  tests/
    integration.test.ts
    authz.test.ts
    edge-cases.test.ts
```

## Validation Rules

- valid role enum only
- target user must exist
- manager assignment may be null
- assigned manager cannot equal target user

## Edge Cases

- non-system admin attempts role change -> `403`
- invalid role -> `400`
- self-demotion -> `400`
- self-deactivation -> `400`
- assign self as manager -> `400`
- deactivate user with pending workflows -> user stays deactivated; workflows remain intact

## Required Tests

- `system_admin` can list users
- employee cannot list users
- authenticated user can read limited profile
- `system_admin` can update role
- invalid role rejected
- self-demotion rejected
- `system_admin` can deactivate other user
- self-deactivation rejected
- manager assignment update works

## Cross-Service Rules

- other services may use only public helpers like `getDirectReportIds`
- other services must not write `users` table directly
- role and manager logic must not be duplicated in business services
