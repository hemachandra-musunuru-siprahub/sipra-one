# Product Requirements Document: SipraHub Intranet MVP

**Version**: 1.0  
**Date**: 2026-04-22  
**Source**: Merged from NK, AS, and HM drafts  
**Status**: Recommended baseline for implementation

---

## 1. Executive Summary

SipraHub needs a lightweight intranet for a 100-person company that replaces fragmented workflows currently spread across email, spreadsheets, Teams/WhatsApp messages, and shared drives. The MVP must give employees one place to read announcements, log timesheets, request leave, access HR documents, and search across core company resources.

The system is authenticated only through Microsoft Entra ID. Documents remain in OneDrive; the intranet stores metadata and links only. The product is built for a small engineering team and should be implementation-ready for AI-assisted coding, with explicit service boundaries, role rules, API contracts, testable acceptance criteria, and a strict Phase 1 scope.

This merged PRD keeps the strongest parts of the three drafts:
- Product framing and open questions from `HM`
- Architectural coverage and delivery constraints from `AS`
- Build-ready stories, RBAC separation, and acceptance criteria from `NK`

---

## 2. Problem Statement

### Current Situation

- Employees use multiple tools for routine operations.
- Timesheets and leave requests are manually coordinated and hard to audit.
- Announcements are inconsistent and easy to miss.
- HR documents are distributed ad hoc through email or chat.
- There is no single role-aware operational portal for employees, managers, HR, and IT administrators.

### Proposed Solution

A mobile-responsive web intranet with Microsoft Entra ID SSO, backed by PostgreSQL, that centralizes:
- Announcements
- Timesheets
- Leave management
- HR document access
- Global search
- User and role administration

### Business Impact

- Reduce manager follow-up overhead for timesheets and leave.
- Improve turnaround time on leave approvals.
- Reduce HR manual work for document access and leave balance setup.
- Create an auditable operational system with clear ownership and permissions.

---

## 3. Goals and Non-Goals

### Goals

- Provide a single SSO-enabled entry point using company Microsoft 365 accounts.
- Enforce all permissions at the API and query level, not only in the UI.
- Deliver six MVP modules: Authentication, Announcements, Timesheets, Leave, HR Documents, and Search.
- Separate HR business operations from technical access control.
- Keep the codebase modular, testable, and AI-friendly.
- Support 100 users comfortably, with a path to 500 without redesign.

### Out of Scope for Phase 1

- Payroll, payslips, tax, statutory compliance flows
- Recruitment or ATS features
- Comment threads or chat
- Email or push notifications
- Native file uploads or blob storage
- Calendar sync
- Multi-level leave approvals
- Half-day leave
- Public holiday rules
- Org chart and skip-level visibility
- Performance goals, ratings, or review cycles
- Native mobile apps
- AI features

---

## 4. Product Scope

### In Scope Modules

1. Authentication and profile sync
2. Announcements feed and reactions
3. Weekly timesheets
4. Leave requests and approvals
5. HR documents registry
6. Global search
7. User roles and activation management

### Core User Journeys

1. Employee logs in with Microsoft 365 and lands on dashboard.
2. Employee reads announcements and reacts with an emoji.
3. Employee creates or updates a draft timesheet and submits it.
4. Manager reviews or rejects a direct report's submitted timesheet.
5. Employee submits a leave request to their assigned manager.
6. Manager approves or rejects a leave request.
7. HR Admin publishes announcements, manages HR documents, and sets leave balances.
8. System Admin manages roles, manager mappings, and account activation.
9. Any authenticated user searches across announcements, employees, and allowed HR documents.

---

## 5. Success Metrics

| Metric | Target | Measurement |
|---|---:|---|
| SSO login success | 100% for valid active M365 accounts | Auth callback / sync logs |
| Timesheet completion time | Full week logged in under 2 minutes | Timed UAT |
| Timesheet submission rate | At least 90% by Friday EOD | Weekly status query |
| Leave routing accuracy | 100% to correct manager | Permission and routing tests |
| Leave approval turnaround | Median under 24 hours | `approved_at - created_at` |
| HR document access | 2 clicks or fewer | UX audit |
| Search privacy | 0 cross-user document leaks | Permission test suite |
| Role enforcement | 0 unauthorized successful actions | Endpoint matrix tests |

---

## 6. Users and Roles

### Employee

- Default role after first successful login
- Can read announcements, manage own timesheets, request leave, view own leave balances, access company and assigned HR documents, and use search

### Manager

- Business approver for direct reports
- Can review submitted timesheets and approve or reject leave requests for direct reports only
- A user becomes a manager when at least one active user points to them as `manager_id`

### HR Admin

- Business operations role
- Can create, edit, pin, and delete announcements
- Can create, edit, and delete HR document records
- Can set or bulk upload leave balances
- Can export timesheet data
- Cannot change user roles, manager mappings, or account activation

### System Admin

- Technical access-control role
- Can change user roles
- Can activate or deactivate accounts
- Can set or fix manager mappings
- Cannot perform HR business operations by default

### Canonical Role Rules

- Roles live in SipraHub's database, not Entra ID
- No combined generic `admin` role exists in MVP
- `hr_admin` and `system_admin` are intentionally separate
- First `hr_admin` and first `system_admin` are bootstrapped via environment configuration or seed script

---

## 7. Architecture Overview

### Recommended Architecture

```text
React SPA
  ->
Nginx / API Gateway
  ->
FastAPI: auth + hr-documents
Node.js/Express: announcements + timesheets + leave + search + users
  ->
PostgreSQL
```

### Architecture Rules

- Prisma-owned migrations if Node.js remains schema owner; FastAPI must not run independent schema migrations.
- Services may share the same database but must keep clear module boundaries.
- Cross-service access goes through public interfaces or HTTP, not internal repository imports.
- No Redis, queues, or event bus in Phase 1.
- OneDrive remains source of truth for file permissions and file content.

### Deep Modules

| Module | Responsibility |
|---|---|
| `IdentityProvider` | Entra token validation, profile sync, session issuance |
| `PostService` | Announcement CRUD, pinning, reactions |
| `TimesheetEngine` | Week creation, entry lifecycle, submission lock, review |
| `LeaveEngine` | Validation, routing, approval transaction, balances |
| `DocumentRegistry` | HR document metadata and scope filtering |
| `SearchGateway` | Unified permission-aware search |
| `UserRegistry` | Roles, activation, manager assignment |

---

## 8. Authentication and Session Model

### Authentication Flow

1. User authenticates with Microsoft Entra ID via MSAL `loginRedirect`.
2. Frontend receives Entra access token.
3. Frontend calls `POST /api/auth/sync` with the Entra token.
4. Backend validates the token against Microsoft's public keys.
5. Backend calls Microsoft Graph for profile and manager data.
6. Backend upserts the local user record.
7. Backend issues an internal session JWT in a secure `httpOnly` cookie.
8. All subsequent API calls use the internal session cookie.

### Session Rules

- No new SipraHub passwords
- No token storage in `localStorage`
- Internal session cookie must be `Secure` and `SameSite=Strict`
- `GET /api/auth/me` is the source of truth for current session state
- Deactivated users must receive `403`

### Profile Sync Rules

- Sync on every successful login
- Update cached name, email, and manager mapping
- If Graph temporarily fails and the user already exists, allow login with cached profile and log a warning

---

## 9. API and Security Standards

### API Rules

- Use `GET`, `POST`, `PATCH`, `DELETE`
- Use plural noun routes
- JSON payloads only
- Pagination via `page` and `limit`
- Validation errors must be explicit and field-specific where applicable

### Standard Error Shape

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable explanation",
  "details": {}
}
```

### Standard Error Codes

- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `INVALID_STATUS`
- `INVALID_ROLE`
- `USER_DEACTIVATED`
- `INSUFFICIENT_BALANCE`
- `NO_MANAGER_ASSIGNED`

### Security Rules

- Every protected endpoint must validate session cookie and role server-side
- Ownership rules are mandatory for employee data
- Permission filters must be applied in SQL or repository queries, not only in application code after fetch
- Backend never proxies OneDrive file content
- Parameterized queries only

---

## 10. Functional Requirements by Module

### 10.1 Authentication

#### Endpoints

- `POST /api/auth/sync`
- `GET /api/auth/me`
- `POST /api/auth/logout`

#### Requirements

- Unauthenticated access to protected pages redirects to Microsoft login.
- `POST /api/auth/sync` validates Entra token, syncs the profile, and creates local session.
- First successful sync assigns:
  - `system_admin` if email matches bootstrap config
  - `hr_admin` if email matches bootstrap config
  - `manager` if user has direct reports
  - otherwise `employee`
- A deactivated user cannot establish a usable session.

### 10.2 Announcements

#### Endpoints

- `GET /api/announcements`
- `POST /api/announcements`
- `PATCH /api/announcements/:id`
- `DELETE /api/announcements/:id`
- `POST /api/announcements/:id/reactions`
- `DELETE /api/announcements/:id/reactions`

#### Requirements

- Feed shows pinned posts first, then unpinned, both sorted by newest first.
- Rich text supports only bold, unordered lists, and links.
- Allowed reactions: `thumbs_up`, `heart`, `laugh`, `surprised`, `sad`
- One reaction per user per post; new reaction replaces old reaction.
- Only `hr_admin` can create, edit, pin, or delete announcements.

### 10.3 Timesheets

#### Endpoints

- `GET /api/timesheets?week=YYYY-MM-DD`
- `POST /api/timesheets/:id/entries`
- `PATCH /api/timesheets/:id/entries/:entryId`
- `DELETE /api/timesheets/:id/entries/:entryId`
- `POST /api/timesheets/:id/submit`
- `GET /api/timesheets/team`
- `PATCH /api/timesheets/:id/status`
- `GET /api/timesheets/export`

#### Requirements

- Timesheets are scoped to ISO weeks.
- A draft week is auto-created on first use if missing.
- Entry fields:
  - `date`
  - `project`
  - `hours`
  - `note`
- Hours must be between `0.5` and `24` in `0.5` increments.
- Employees can edit only their own draft timesheets.
- Valid status transitions:
  - `draft -> submitted` by employee
  - `submitted -> reviewed` by manager
  - `submitted -> draft` by manager rejection
- Submitted and reviewed timesheets are locked to the employee.
- Managers can act only on direct reports.
- CSV export is available to `hr_admin` only.

### 10.4 Leave Management

#### Endpoints

- `GET /api/leave-requests`
- `POST /api/leave-requests`
- `PATCH /api/leave-requests/:id`
- `DELETE /api/leave-requests/:id`
- `GET /api/leave-requests/team`
- `GET /api/leave-balances`
- `PATCH /api/leave-balances/:employeeId`
- `POST /api/leave-balances/bulk`

#### Requirements

- Leave types: `annual`, `sick`, `unpaid`, `other`
- `start_date` must be less than or equal to `end_date`
- Requested days are working days excluding Saturday and Sunday
- Public holidays are ignored in MVP
- If the employee has no assigned manager, submission fails with `NO_MANAGER_ASSIGNED`
- Balance is checked at submission for balance-managed leave types
- Approved leave decrements balance atomically in the same DB transaction as status change
- Rejected leave requires a rejection reason
- Pending leave can be canceled by the employee
- Canceling approved leave does not restore balance in MVP
- `hr_admin` can set balances and bulk upload balances
- Managers can approve or reject only for direct reports

### 10.5 HR Documents

#### Endpoints

- `GET /api/hr-documents`
- `GET /api/hr-documents/:id`
- `POST /api/hr-documents`
- `PATCH /api/hr-documents/:id`
- `DELETE /api/hr-documents/:id`

#### Requirements

- Documents store metadata and OneDrive URL only
- Scope values:
  - `company`
  - `individual`
- `individual` documents require `assigned_user_id`
- Employees can see:
  - all `company` documents
  - their own `individual` documents
- Managers do not get extra visibility into direct reports' documents
- `hr_admin` manages the document registry
- URLs must be valid SharePoint or OneDrive links

### 10.6 Search

#### Endpoints

- `GET /api/search?q=...`

#### Requirements

- Search covers:
  - announcement titles and bodies
  - active employee names and emails
  - allowed HR document titles and types
- Search excludes:
  - timesheets
  - leave requests
  - HR documents outside caller visibility
- Query shorter than 2 characters returns an empty result set
- Results are grouped by category
- Use PostgreSQL full-text search and indexed keyword matching

### 10.7 Users and Roles

#### Endpoints

- `GET /api/users`
- `GET /api/users/:id`
- `PATCH /api/users/:id/role`
- `PATCH /api/users/:id/active`
- `PATCH /api/users/:id/manager`

#### Requirements

- `system_admin` can list users, change roles, activate or deactivate users, and update manager assignment.
- A `system_admin` cannot demote or deactivate themselves.
- Valid roles:
  - `employee`
  - `manager`
  - `hr_admin`
  - `system_admin`
- Employees and managers may only see limited profile fields on other users.

---

## 11. Data Model Summary

### Core Tables

- `users`
- `announcements`
- `announcement_reactions`
- `timesheet_weeks`
- `timesheet_entries`
- `leave_requests`
- `leave_balances`
- `hr_documents`

### Important Fields

#### `users`

- `id` (PK)
- `entra_oid` (Unique)
- `email`
- `name`
- `manager_entra_oid`
- `is_active`
- `created_at`
- `last_login`

#### `announcements`

- `id`
- `title`
- `body`
- `author_id`
- `is_pinned`
- `created_at`
- `updated_at`

#### `timesheet_weeks`

- `id`
- `employee_id`
- `week_start_date`
- `status`
- `submitted_at`
- `reviewed_at`
- `reviewed_by`

#### `timesheet_entries`

- `id`
- `timesheet_id`
- `entry_date`
- `project`
- `hours`
- `note`

#### `leave_requests`

- `id`
- `employee_id`
- `manager_id`
- `leave_type`
- `start_date`
- `end_date`
- `working_days_requested`
- `status`
- `rejection_reason`
- `created_at`
- `updated_at`

#### `leave_balances`

- `id`
- `employee_id`
- `leave_type`
- `year`
- `total_days`
- `used_days`

#### `hr_documents`

- `id`
- `title`
- `type`
- `scope`
- `assigned_user_id`
- `onedrive_url`
- `created_by`
- `created_at`

---

## 12. UI and Frontend Rules

### Screen to API Mapping

| Screen | API |
|---|---|
| Dashboard | `/api/auth/me`, `/api/announcements` |
| Timesheet page | `/api/timesheets`, entry routes, submit route |
| Leave page | `/api/leave-balances`, `/api/leave-requests` |
| Manager approvals | `/api/timesheets/team`, `/api/leave-requests/team` |
| HR documents | `/api/hr-documents` |
| Search bar | `/api/search` |
| Admin users | `/api/users` |

### Frontend State Rules

- Auth state via top-level context
- Server state via React Query or equivalent
- Form state via React Hook Form or equivalent
- No Redux for API state

### Design Constraints

- Token-based design system variables, not hardcoded styles
- Responsive layout for desktop and mobile
- Clear empty states and validation states
- One clear primary action per screen

---

## 13. Non-Functional Requirements

| Category | Requirement |
|---|---|
| API latency | Under 300ms P95 for normal CRUD |
| Search latency | Under 500ms P95 |
| Initial page load | Under 2 seconds on typical office broadband |
| Availability | 99.5% during business hours |
| Scale | 100 concurrent users in MVP; no horizontal scaling required |
| Observability | Structured JSON logs and per-service health endpoints |
| Auditability | Review and approval actions store actor and timestamp |
| Browser support | Latest 2 versions of Chrome, Edge, Firefox, Safari |

---

## 14. Logging, Monitoring, and Deployment

### Logging

- Structured JSON logs
- `x-request-id` propagated from gateway to services
- Slow queries over 500ms logged as warnings
- Unhandled server errors logged with stack trace

### Health Checks

- `/health` endpoint per service
- Health includes process status and database connectivity

### Environments

1. Development: Docker Compose with hot reload
2. Staging: production-like cloud environment with test tenant
3. Production: managed PostgreSQL plus gateway and app services

### Environment Variables

- `DATABASE_URL`
- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_CLIENT_SECRET`
- `FRONTEND_URL`
- `INITIAL_HR_ADMIN_EMAIL`
- `INITIAL_SYSTEM_ADMIN_EMAIL`
- session signing configuration shared by services

---

## 15. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Entra app registration misconfigured | Medium | High | Validate auth in Sprint 1 against real tenant |
| Manager mappings missing at launch | High | High | Mandatory pre-launch verification script |
| Leave balances not seeded | High | Medium | Seed script plus admin checklist |
| OneDrive sharing misconfigured | Medium | High | Save-time warning and admin checklist |
| Double balance deduction on retry | Low | High | DB transaction plus idempotent approval handling |
| Role confusion between HR and System Admin | Medium | High | Strict route guards and RBAC tests |
| Scope creep into HRMS features | High | Medium | Enforce out-of-scope list in backlog grooming |

---

## 16. Dependencies and Open Questions

### External Dependencies

- Microsoft Entra ID app registration
- Microsoft Graph API permissions
- OneDrive / SharePoint access model
- PostgreSQL hosting

### Internal Build Dependencies

1. Auth and user sync
2. Roles and manager mapping
3. Announcements, leave, timesheets, HR documents
4. Search after searchable data exists
5. Hardening, UAT, and launch prep

### Open Questions

- Final production hosting target: Azure App Service, ECS, or VPS?
- Exact session expiry window for internal JWT cookie?
- Whether retroactive leave should be allowed before launch?
- Whether PostgreSQL full-text search is sufficient after MVP scale-up?

---

## 17. Delivery Plan

### Phase 1: Foundation

- Project scaffolding
- Auth flow
- User sync
- Session model
- Roles and manager mapping

### Phase 2: Core Workflows

- Announcements
- Timesheets
- Leave
- HR documents

### Phase 3: Search and Hardening

- Global search
- Permission audit
- Performance tuning
- UAT
- Deployment checklist

---

## 18. Acceptance and Verification

### Acceptance Philosophy

Test behavior at service interfaces, not implementation internals. Every module must have integration tests covering normal flow, permissions, validation, and edge cases.

### Mandatory Test Categories

- Auth
- Role matrix
- Ownership checks
- Validation errors
- State transitions
- Search visibility
- End-to-end happy paths

### Minimum Verification Checklist

1. Valid M365 user can log in and reach dashboard.
2. Deactivated user receives `403`.
3. Employee cannot access another employee's private data.
4. Manager can act only on direct reports.
5. `hr_admin` cannot change roles or activation state.
6. `system_admin` cannot create announcements or HR documents.
7. Submitted timesheet is locked until manager review or rejection.
8. Approved leave decrements balance exactly once.
9. Search never returns unauthorized HR documents.
10. All documented endpoint and permission tests pass in CI.

---

## 19. Recommendation

Use this merged PRD as the implementation baseline. If one follow-up artifact is added before development starts, it should be a short companion document that defines:
- exact API payload examples
- final deployment target
- final design system tokens/components

That would remove the remaining ambiguity without expanding MVP scope.
