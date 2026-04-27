# SipraHub Repo Blueprint

This document turns the merged PRD into a concrete, AI-friendly repository structure.

The goal is to make the file system match the product map:
- `auth`
- `announcements`
- `timesheets`
- `leave`
- `hr-documents`
- `search`
- `users`

The repo should optimize for:
- clear service ownership
- strict public interfaces
- minimal cross-service coupling
- high test coverage at service seams
- easy AI delegation inside bounded modules

---

## 1. Recommended Repo Shape

```text
siprahub/
  apps/
    web/
      src/
        app/
          router/
          providers/
          layout/
        features/
          auth/
          announcements/
          timesheets/
          leave/
          hr-documents/
          search/
          users/
        shared-ui/
        shared-lib/
        test/
      package.json
      vite.config.ts

  services/
    auth/
      app/
        public.py
        routes.py
        service.py
        repo.py
        schema.py
        types.py
        authz.py
      tests/
      pyproject.toml

    announcements/
      src/
        public.ts
        routes.ts
        service.ts
        repo.ts
        schema.ts
        types.ts
        authz.ts
      tests/
      package.json

    timesheets/
      src/
        public.ts
        routes.ts
        service.ts
        repo.ts
        schema.ts
        types.ts
        authz.ts
      tests/
      package.json

    leave/
      src/
        public.ts
        routes.ts
        service.ts
        repo.ts
        schema.ts
        types.ts
        authz.ts
      tests/
      package.json

    hr-documents/
      app/
        public.py
        routes.py
        service.py
        repo.py
        schema.py
        types.py
        authz.py
      tests/
      pyproject.toml

    search/
      src/
        public.ts
        routes.ts
        service.ts
        repo.ts
        schema.ts
        types.ts
        authz.ts
      tests/
      package.json

    users/
      src/
        public.ts
        routes.ts
        service.ts
        repo.ts
        schema.ts
        types.ts
        authz.ts
      tests/
      package.json

  packages/
    contracts/
      src/
        auth.ts
        announcements.ts
        timesheets.ts
        leave.ts
        hr-documents.ts
        search.ts
        users.ts
        shared.ts
    ui/
    config/

  infra/
    docker/
    nginx/
    scripts/

  docs/
    repo-blueprint.md
    services/
      auth.md
      announcements.md
      timesheets.md
      leave.md
      hr-documents.md
      search.md
      users.md

  .github/
    workflows/
```

---

## 2. Service Boundary Rules

Each service owns:
- its routes
- request and response schemas
- domain logic
- data access
- permission checks specific to that service
- its own integration tests

Each service exposes exactly one public entrypoint:
- Python services: `public.py`
- TypeScript services: `public.ts`

Other services may import only that public entrypoint, never:
- `repo.*`
- `service.*`
- `schema.*`
- internal helper files

This rule matters more than framework choice. It is what keeps the codebase understandable to humans and AI.

---

## 3. Allowed Dependencies

| Service | Can depend on | Cannot depend on |
|---|---|---|
| `auth` | shared contracts, DB, Graph client | internals of any business service |
| `announcements` | `auth` public API, shared contracts | `leave`, `timesheets`, `users` internals |
| `timesheets` | `auth` public API, `users` public API | `leave` internals, `search` internals |
| `leave` | `auth` public API, `users` public API | `timesheets` internals, `search` internals |
| `hr-documents` | `auth` public API | `users` internals except public API |
| `search` | `auth` public API, read-only public search helpers from searchable services | write APIs from any service |
| `users` | `auth` public API | all business-service internals |
| `apps/web` | package contracts only, HTTP APIs | direct DB access, backend internals |

Additional rules:
- `search` is read-only.
- `users` owns role and manager assignment writes.
- `auth` owns session creation and current-user resolution.
- `leave` and `timesheets` must not call each other.

---

## 4. Shared Packages

Keep shared code narrow. The default should be "belongs to a service" unless there is a strong reason otherwise.

### `packages/contracts`

Owns:
- transport-level request and response types
- shared enums used across frontend and backend
- pagination types
- common error codes

Does not own:
- business logic
- DB access
- side effects
- policy decisions

### `packages/ui`

Owns:
- shared UI primitives
- design-system wrappers

Does not own:
- feature-specific state
- service-specific forms

### `packages/config`

Owns:
- lint config
- tsconfig presets
- formatter config
- test presets

---

## 5. Standard Service Layout

### TypeScript Service Skeleton

```text
service-name/
  src/
    public.ts    # only file other services may import
    routes.ts    # HTTP route wiring only
    service.ts   # domain logic and orchestration
    repo.ts      # DB queries only
    schema.ts    # zod or request/response validators
    types.ts     # internal domain types
    authz.ts     # service-specific authorization helpers
  tests/
    integration.test.ts
    authz.test.ts
    edge-cases.test.ts
```

### Python Service Skeleton

```text
service-name/
  app/
    public.py    # only file other services may import
    routes.py    # FastAPI router only
    service.py   # domain logic and orchestration
    repo.py      # SQLAlchemy data access only
    schema.py    # pydantic models
    types.py     # domain dataclasses / type aliases
    authz.py     # service-specific authorization helpers
  tests/
    test_integration.py
    test_authz.py
    test_edge_cases.py
```

Rules:
- `routes` contains no business logic.
- `repo` contains no policy logic.
- `service` is the only place where state transitions happen.
- `public` re-exports only the sanctioned API for cross-service use.

---

## 6. Frontend Feature Layout

Mirror the service map in the frontend.

```text
apps/web/src/features/
  auth/
    api.ts
    hooks.ts
    routes.tsx
    components/
  announcements/
    api.ts
    hooks.ts
    routes.tsx
    components/
  timesheets/
  leave/
  hr-documents/
  search/
  users/
```

Rules:
- feature code lives under its feature folder
- feature APIs use `packages/contracts`
- cross-feature imports should be rare and go through explicit APIs
- no giant `utils/` dumping ground

---

## 7. Contracts First Workflow

For every service:

1. Write or update `docs/services/<service>.md`
2. Create `packages/contracts/src/<service>.ts`
3. Create `public.*`
4. Write service integration tests
5. Implement `routes`, `service`, `repo`, `schema`, `authz`
6. Wire frontend feature against the contract

That sequence is the implementation policy. Do not start with controllers or DB tables in isolation.

---

## 8. Build Order

1. `auth`
2. `users`
3. `announcements`
4. `timesheets`
5. `leave`
6. `hr-documents`
7. `search`
8. frontend shell and feature wiring in parallel once contracts exist

Why:
- `auth` is required for all protected work
- `users` owns roles and manager assignment
- `search` depends on searchable data from other services

---

## 9. Definition of Done Per Service

A service is only "done" when all of the following are true:
- service spec exists in `docs/services`
- public contract exists
- routes map 1:1 to owned endpoints
- RBAC checks exist and are tested
- ownership filters exist and are tested
- state transitions are tested
- edge cases from the service spec are covered
- no cross-service internal imports exist

---

## 10. What To Avoid

Do not organize the backend like this:

```text
backend/
  controllers/
  models/
  repositories/
  services/
  utils/
```

That shape is easy to start and hard to maintain. It breaks the mental map and causes AI agents to chase implementation details across too many shallow folders.

Avoid:
- large generic `helpers` directories
- role logic duplicated across services
- shared code created too early
- cross-service DB writes outside the owning service
- frontend feature code mixed into shared folders

---

## 11. Next Implementation Artifacts

Use these files alongside this blueprint:
- [auth.md](/Users/a381418/WORK/Intranet%20PoC/docs/services/auth.md)
- [announcements.md](/Users/a381418/WORK/Intranet%20PoC/docs/services/announcements.md)
- [timesheets.md](/Users/a381418/WORK/Intranet%20PoC/docs/services/timesheets.md)
- [leave.md](/Users/a381418/WORK/Intranet%20PoC/docs/services/leave.md)
- [hr-documents.md](/Users/a381418/WORK/Intranet%20PoC/docs/services/hr-documents.md)
- [search.md](/Users/a381418/WORK/Intranet%20PoC/docs/services/search.md)
- [users.md](/Users/a381418/WORK/Intranet%20PoC/docs/services/users.md)
