# Search Service Spec

## Purpose

Own unified, read-only search across announcements, employees, and allowed HR documents.

## Owns

- grouped search response
- permission-aware filtering
- cross-table search orchestration

## Does Not Own

- writes to any business table
- semantic search
- external search infrastructure in MVP

## Routes

- `GET /api/search?q=...`

## Public Interface

```ts
export type SearchResultItem = {
  id: string;
  type: "announcement" | "employee" | "document";
  title: string;
  subtitle?: string;
  url?: string;
};

export type SearchResponse = {
  query: string;
  announcements: SearchResultItem[];
  employees: SearchResultItem[];
  documents: SearchResultItem[];
  totalCount: number;
};

export async function searchAll(query: string, actorId: string): Promise<SearchResponse>;
```

## Data Owned

This service owns no primary business tables.

It owns:
- search query composition
- grouped result shaping
- permission-aware read logic

## Domain Rules

- Search covers:
  - announcement titles and bodies
  - active employee names and emails
  - HR document titles and types visible to the caller
- Search excludes:
  - timesheets
  - leave requests
  - unauthorized HR documents
- Query shorter than 2 characters returns an empty result set.
- Query length is capped before processing.
- Result groups are returned even when empty.

## Authorization Rules

| Operation | Role |
|---|---|
| Search | any authenticated user |

Search is read-only and permission filtered.

## File Skeleton

```text
services/search/
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

- `q` is required
- trimmed query under 2 chars returns empty response
- max query length enforced before DB call

## Edge Cases

- no results -> grouped empty arrays
- query with SQL special chars -> still safe via parameterized queries
- unauthorized individual HR docs must never leak
- inactive users must not appear in employee results

## Required Tests

- short query returns empty result
- announcement title match appears in announcements group
- employee name match appears in employees group
- company doc match appears in documents group
- another user's individual HR doc never appears
- inactive user never appears
- search does not query or return leave or timesheet data

## Cross-Service Rules

- `search` may read from service-owned read helpers or read models only
- `search` must not call write functions from any service
- `search` must not become a dumping ground for shared business logic
