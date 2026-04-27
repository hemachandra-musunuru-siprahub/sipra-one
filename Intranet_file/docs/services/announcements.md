# Announcements Service Spec

## Purpose

Own company announcements, feed ordering, pinning, and reactions.

## Owns

- announcement CRUD
- pinned feed ordering
- reaction upsert and deletion
- announcement-level validation

## Does Not Own

- comments
- notifications
- analytics beyond basic future-ready fields

## Routes

- `GET /api/announcements`
- `POST /api/announcements`
- `PATCH /api/announcements/:id`
- `DELETE /api/announcements/:id`
- `POST /api/announcements/:id/reactions`
- `DELETE /api/announcements/:id/reactions`

## Public Interface

TypeScript service; `public.ts` is the only cross-service import.

```ts
export type ReactionCode =
  | "thumbs_up"
  | "heart"
  | "laugh"
  | "surprised"
  | "sad";

export type AnnouncementFeedItem = {
  id: string;
  title: string;
  bodyHtml: string;
  authorId: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReactionSummary = Record<ReactionCode, number>;

export async function getFeed(page: number, limit: number): Promise<AnnouncementFeedItem[]>;
export async function createAnnouncement(input: CreateAnnouncementInput, actorId: string): Promise<AnnouncementFeedItem>;
export async function updateAnnouncement(id: string, input: UpdateAnnouncementInput, actorId: string): Promise<AnnouncementFeedItem>;
export async function deleteAnnouncement(id: string, actorId: string): Promise<void>;
export async function upsertReaction(id: string, emoji: ReactionCode, actorId: string): Promise<ReactionSummary>;
export async function removeReaction(id: string, actorId: string): Promise<ReactionSummary>;
```

## Data Owned

- `announcements`
- `announcement_reactions`

## Domain Rules

- Feed returns pinned posts first, then unpinned.
- Both pinned and unpinned groups sort by `created_at DESC`.
- Rich text is sanitized on write.
- Allowed HTML tags: bold, unordered lists, links.
- Only one reaction per user per post.
- Posting a new reaction replaces the previous one.
- Deleting an announcement deletes reactions in the same transaction.

## Authorization Rules

| Operation | Role |
|---|---|
| Read feed | any authenticated user |
| React | any authenticated user |
| Create | `hr_admin` only |
| Update | `hr_admin` only |
| Delete | `hr_admin` only |

`system_admin` does not inherit announcement permissions by default.

## File Skeleton

```text
services/announcements/
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

- title required
- title max length 255
- body required
- reaction code must be one of allowed enum
- pagination defaults to page 1, limit 20

## Edge Cases

- invalid reaction code -> `400`
- reaction on missing post -> `404`
- non-`hr_admin` create/update/delete -> `403`
- empty title -> `400`
- delete already deleted post -> `404` or idempotent `204`, choose one policy and keep it consistent

## Required Tests

- feed ordering pinned then unpinned
- create rejected for employee
- create rejected for manager
- create rejected for system admin
- create succeeds for `hr_admin`
- invalid title rejected
- reaction upsert replaces previous reaction
- delete reaction updates summary
- delete announcement cascades reactions

## Cross-Service Rules

- no direct imports from `users`
- author display data should come from joined read model or caller-side profile cache, not cross-service write calls
