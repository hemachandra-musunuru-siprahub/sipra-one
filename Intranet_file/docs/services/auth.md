# Auth Service Spec

## Purpose

Own authentication, Entra profile sync, session issuance, current-user resolution, and shared authorization helpers.

This service is the identity boundary for the whole system.

## Owns

- Entra token validation
- profile sync from Microsoft Graph
- local user upsert on login
- session cookie issuance and logout
- current session lookup
- bootstrap role assignment on first login
- shared authz helpers used by other services

## Does Not Own

- announcements
- timesheets
- leave decisions
- HR document business rules
- user role changes after bootstrap

## Routes

- `POST /api/auth/sync`
- `GET /api/auth/me`
- `POST /api/auth/logout`

## Public Interface

Python service; `public.py` is the only cross-service import.

```python
from dataclasses import dataclass
from typing import Literal
from uuid import UUID

AppRole = Literal["employee", "manager", "hr_admin", "system_admin"]

@dataclass
class UserSession:
    user_id: UUID
    entra_oid: str
    email: str
    name: str
    role: AppRole
    manager_id: UUID | None
    is_active: bool

def sync_and_issue_session(entra_access_token: str) -> UserSession: ...
def get_session_from_request(request) -> UserSession: ...
def clear_session(response) -> None: ...
def require_role(session: UserSession, roles: list[AppRole]) -> None: ...
```

## Data Owned

Primary table touched:
- `users`

Fields read or updated:
- `entra_oid`
- `email`
- `name`
- `job_title`
- `department`
- `manager_id`
- `role`
- `is_active`
- `last_login`

## Domain Rules

- All protected APIs rely on the local SipraHub session, not raw Entra access tokens.
- `POST /api/auth/sync` validates the Entra token against Microsoft's public keys.
- Successful sync updates cached user profile fields from Graph.
- If the email matches `INITIAL_SYSTEM_ADMIN_EMAIL`, first login role is `system_admin`.
- If the email matches `INITIAL_HR_ADMIN_EMAIL`, first login role is `hr_admin`.
- If a user has direct reports, role may resolve to `manager` if not already `hr_admin` or `system_admin`.
- Deactivated users must receive `403 USER_DEACTIVATED`.
- If Graph is temporarily unavailable and the user already exists, permit login with cached profile and log a warning.

## Authorization Rules

- `POST /api/auth/sync` is public
- `GET /api/auth/me` requires valid local session
- `POST /api/auth/logout` requires valid local session
- role changes are not handled here; they belong to `users`

## File Skeleton

```text
services/auth/
  app/
    public.py
    routes.py
    service.py
    repo.py
    schema.py
    types.py
    authz.py
  tests/
    test_integration.py
    test_authz.py
    test_edge_cases.py
```

## Implementation Notes

- `routes.py` should only parse requests, call service functions, and set or clear cookies.
- `service.py` should own token verification, Graph sync orchestration, and role bootstrap logic.
- `repo.py` should own only DB queries for `users`.
- `authz.py` should export shared helpers used by other services, but not business-service rules.

## Edge Cases

- expired or invalid Entra token -> `401`
- deactivated user -> `403`
- missing session cookie on protected route -> `401`
- first bootstrap admin login -> role assigned correctly
- Graph manager lookup returns none -> `manager_id = null`
- Entra email changed but `entra_oid` matches existing user -> update email, do not create duplicate

## Required Tests

- valid sync creates session and returns current user
- invalid token returns `401`
- deactivated user returns `403`
- logout clears cookie
- bootstrap `hr_admin` role assignment works
- bootstrap `system_admin` role assignment works
- cached profile fallback works when Graph fails for existing user
- `require_role` rejects insufficient roles

## Cross-Service Rules

Other services may use only:
- `get_session_from_request`
- `require_role`
- exported `UserSession` and role types

Other services must not import:
- `repo.py`
- `service.py`
- Graph client internals
