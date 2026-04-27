# HR Documents Service Spec

## Purpose

Own HR document metadata, visibility scope, and OneDrive link registry.

## Owns

- create, update, delete metadata records
- company vs individual scope filtering
- OneDrive URL validation

## Does Not Own

- file uploads
- file proxying
- OneDrive permission management

## Routes

- `GET /api/hr-documents`
- `GET /api/hr-documents/:id`
- `POST /api/hr-documents`
- `PATCH /api/hr-documents/:id`
- `DELETE /api/hr-documents/:id`

## Public Interface

Python service; `public.py` is the only cross-service import.

```python
from dataclasses import dataclass
from typing import Literal
from uuid import UUID

DocumentScope = Literal["company", "individual"]

@dataclass
class HRDocument:
    id: UUID
    title: str
    doc_type: str
    scope: DocumentScope
    assigned_user_id: UUID | None
    onedrive_url: str
    created_by: UUID

def list_documents(actor_id: UUID) -> list[HRDocument]: ...
def get_document(document_id: UUID, actor_id: UUID) -> HRDocument: ...
def create_document(input_data, actor_id: UUID) -> HRDocument: ...
def update_document(document_id: UUID, input_data, actor_id: UUID) -> HRDocument: ...
def delete_document(document_id: UUID, actor_id: UUID) -> None: ...
```

## Data Owned

- `hr_documents`

## Domain Rules

- Documents store metadata and URL only.
- Scope is either `company` or `individual`.
- `individual` requires `assigned_user_id`.
- Employees can view:
  - all company docs
  - their own individual docs
- Managers do not gain direct-report document visibility.
- Backend never fetches OneDrive file contents.

## Authorization Rules

| Operation | Role |
|---|---|
| Read allowed docs | any authenticated user |
| Create | `hr_admin` only |
| Update | `hr_admin` only |
| Delete | `hr_admin` only |

`system_admin` does not inherit HR document permissions by default.

## File Skeleton

```text
services/hr-documents/
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

## Validation Rules

- title required
- title max length 255
- valid `scope`
- if `scope = individual`, `assigned_user_id` required
- URL must match approved SharePoint or OneDrive patterns

## Edge Cases

- invalid URL -> `400`
- missing assigned user for individual doc -> `400`
- user requesting another user's individual doc -> `403` or `404`, choose one and keep it consistent
- stale OneDrive link remains in registry until removed by `hr_admin`

## Required Tests

- employee sees company docs
- employee sees own individual docs
- employee cannot see another employee's individual docs
- manager does not see direct report's individual docs
- create rejected for employee
- create rejected for manager
- create rejected for system admin
- create succeeds for `hr_admin`
- invalid URL rejected
- delete succeeds for `hr_admin`

## Cross-Service Rules

- no direct imports from `users` internals
- user existence checks may use `users` public API if needed
