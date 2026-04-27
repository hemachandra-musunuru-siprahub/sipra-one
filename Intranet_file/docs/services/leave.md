# Leave Service Spec

## Purpose

Own leave requests, manager approval flow, leave balances, and bulk balance upload.

## Owns

- request submission
- balance validation
- manager routing
- approve and reject flow
- pending cancellation
- leave balance reads and writes
- bulk upload of leave balances

## Does Not Own

- public holiday calendars
- half-day leave
- accrual automation
- multi-level approvals

## Routes

- `GET /api/leave-requests`
- `POST /api/leave-requests`
- `PATCH /api/leave-requests/:id`
- `DELETE /api/leave-requests/:id`
- `GET /api/leave-requests/team`
- `GET /api/leave-balances`
- `PATCH /api/leave-balances/:employeeId`
- `POST /api/leave-balances/bulk`

## Public Interface

```ts
export type LeaveType = "annual" | "sick" | "unpaid" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export type LeaveRequest = {
  id: string;
  employeeId: string;
  managerId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  workingDaysRequested: number;
  status: LeaveStatus;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeaveBalance = {
  employeeId: string;
  leaveType: LeaveType;
  year: number;
  totalDays: number;
  usedDays: number;
};

export async function submitLeaveRequest(input: CreateLeaveRequestInput, actorId: string): Promise<LeaveRequest>;
export async function actionLeaveRequest(id: string, input: ActionLeaveRequestInput, actorId: string): Promise<LeaveRequest>;
export async function cancelLeaveRequest(id: string, actorId: string): Promise<LeaveRequest>;
export async function getOwnLeaveRequests(actorId: string): Promise<LeaveRequest[]>;
export async function getTeamLeaveRequests(managerId: string): Promise<LeaveRequest[]>;
export async function getLeaveBalances(actorId: string, employeeId?: string): Promise<LeaveBalance[]>;
export async function setLeaveBalance(input: SetLeaveBalanceInput, actorId: string): Promise<LeaveBalance>;
export async function bulkUploadLeaveBalances(file: Buffer, actorId: string): Promise<BulkUploadResult>;
```

## Data Owned

- `leave_requests`
- `leave_balances`

## Domain Rules

- Leave types: `annual`, `sick`, `unpaid`, `other`
- `start_date` must be less than or equal to `end_date`
- Requested days are working days excluding Saturday and Sunday
- No public holiday logic in MVP
- If user has no manager, submission fails with `NO_MANAGER_ASSIGNED`
- Balance is checked on submission for managed leave types
- `unpaid` may bypass balance check if policy decides so; lock this in code and tests
- Approval must atomically:
  - set request status to approved
  - increment `used_days`
- Rejection requires `rejection_reason`
- Employee may cancel only pending requests
- Canceling approved leave does not restore balance in MVP

## Authorization Rules

| Operation | Role |
|---|---|
| Submit request | owner |
| View own requests | owner |
| Cancel pending request | owner |
| View team pending requests | `manager` for direct reports |
| Approve or reject | `manager` for direct reports |
| View own balances | owner |
| Set balances | `hr_admin` only |
| Bulk upload balances | `hr_admin` only |

## File Skeleton

```text
services/leave/
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

- valid leave type enum only
- start date <= end date
- dates use ISO `YYYY-MM-DD`
- bulk upload CSV columns required:
  - `email`
  - `leave_type`
  - `total_days`

## Edge Cases

- no manager assigned -> `422`
- insufficient balance -> `400` or `422`, choose one and keep it consistent
- reject without reason -> `400`
- approve already approved request -> `409`
- wrong manager acts on request -> `403`
- invalid CSV rows are skipped and reported
- duplicate approvals under retry load must not double decrement balance

## Required Tests

- valid request creates pending leave
- invalid date range rejected
- insufficient balance rejected
- no-manager case rejected
- approval decrements balance exactly once
- rejection requires reason
- employee can cancel pending request
- employee cannot cancel approved request
- non-`hr_admin` cannot set balances
- bulk upload returns updated count and row errors

## Cross-Service Rules

- use `users` public API for manager resolution only
- do not import `users` internals
- do not write to any tables outside leave-owned tables
