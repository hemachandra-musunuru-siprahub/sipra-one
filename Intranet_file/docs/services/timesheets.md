# Timesheets Service Spec

## Purpose

Own weekly timesheets, entry lifecycle, submission lock, manager review, and CSV export.

## Owns

- week creation and lookup
- entry create, update, delete
- draft, submitted, reviewed state transitions
- manager rejection back to draft
- team views for direct managers
- CSV export

## Does Not Own

- payroll
- attendance
- auto submission reminders

## Routes

- `GET /api/timesheets?week=YYYY-MM-DD`
- `POST /api/timesheets/:id/entries`
- `PATCH /api/timesheets/:id/entries/:entryId`
- `DELETE /api/timesheets/:id/entries/:entryId`
- `POST /api/timesheets/:id/submit`
- `GET /api/timesheets/team`
- `PATCH /api/timesheets/:id/status`
- `GET /api/timesheets/export`

## Public Interface

```ts
export type TimesheetStatus = "draft" | "submitted" | "reviewed";

export type TimesheetEntry = {
  id: string;
  entryDate: string;
  project: string;
  hours: number;
  note?: string | null;
};

export type Timesheet = {
  id: string;
  employeeId: string;
  weekStartDate: string;
  status: TimesheetStatus;
  entries: TimesheetEntry[];
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
};

export async function getOrCreateWeek(employeeId: string, weekStartDate: string): Promise<Timesheet>;
export async function addEntry(timesheetId: string, input: CreateTimesheetEntryInput, actorId: string): Promise<Timesheet>;
export async function updateEntry(timesheetId: string, entryId: string, input: UpdateTimesheetEntryInput, actorId: string): Promise<Timesheet>;
export async function deleteEntry(timesheetId: string, entryId: string, actorId: string): Promise<Timesheet>;
export async function submitTimesheet(timesheetId: string, actorId: string): Promise<Timesheet>;
export async function updateTimesheetStatus(timesheetId: string, status: "draft" | "reviewed", actorId: string): Promise<Timesheet>;
export async function getTeamTimesheets(managerId: string): Promise<Timesheet[]>;
export async function exportTimesheets(range: ExportTimesheetsInput, actorId: string): Promise<Buffer>;
```

## Data Owned

- `timesheet_weeks`
- `timesheet_entries`

## Domain Rules

- Timesheets are scoped to ISO week.
- `week_start_date` must normalize to Monday.
- A draft week is auto-created on first use if missing.
- Entries may be changed only in `draft`.
- Valid transitions:
  - `draft -> submitted` by employee
  - `submitted -> reviewed` by manager
  - `submitted -> draft` by manager rejection
- A submitted timesheet is locked to the employee.
- Managers may act only on direct reports.
- Timesheet must have at least one entry before submit.
- Export includes reviewed timesheets only unless a later policy explicitly expands scope.

## Authorization Rules

| Operation | Role |
|---|---|
| View own week | owner |
| Edit own draft | owner |
| Submit own draft | owner |
| View team submitted timesheets | `manager` for direct reports |
| Review or reject team timesheet | `manager` for direct reports |
| Export CSV | `hr_admin` only |

## File Skeleton

```text
services/timesheets/
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

- `project` required, max 100 chars
- `hours` between `0.5` and `24`
- `hours` in `0.5` increments
- `note` max 500 chars
- `entryDate` must fall inside the target ISO week

## Edge Cases

- submit already submitted -> `409`
- edit submitted timesheet -> `403`
- zero-entry submit -> `400` or `422`, choose one and keep it consistent
- wrong manager acting on timesheet -> `403`
- non-Monday week query -> normalize to Monday
- export with no data -> return empty CSV with headers

## Required Tests

- auto-create week on first access
- invalid hours rejected
- out-of-week entry rejected
- submit locks the timesheet
- manager can review direct report
- manager can reject direct report back to draft
- manager cannot act on non-direct-report
- employee cannot view team endpoint
- manager cannot export
- `hr_admin` can export

## Cross-Service Rules

- direct report checks may use `users` public API only
- do not call `leave` for any workflow decision
