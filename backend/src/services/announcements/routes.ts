import { Router, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { notFound, forbidden } from "../../lib/errors";
import { isAdmin, isHR, HR_ROLES } from "../../lib/roles";
import * as repo from "./repo";

const router = Router();

const ALLOWED_REACTIONS = ["thumbs_up", "heart", "laugh", "surprised", "sad"] as const;

// ─── GET /api/announcements — paginated feed ───────────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const items = await repo.getFeed(page, limit);
  res.json({ announcements: items, page, limit });
});

// ─── POST /api/announcements — create (hr_admin only) ────────────────────────
const CreateSchema = z.object({
  title:    z.string().min(1).max(255),
  body:     z.string().min(1),
  category: z.string().max(100).optional(),
  isPinned: z.boolean().optional().default(false),
});

router.post("/", requireAuth, requireRole([...HR_ROLES]),
  validate(CreateSchema),
  async (req: AuthRequest, res: Response) => {
    const { title, body, category, isPinned } = req.body;
    const item = await repo.createAnnouncement(title, body, category, isPinned, req.user!.entra_oid);
    res.status(201).json({ announcement: item });
  }
);

// ─── PATCH /api/announcements/:id — edit (hr_admin only) ──────────────────────
const UpdateSchema = z.object({
  title:     z.string().min(1).max(255).optional(),
  body:      z.string().min(1).optional(),
  category:  z.string().max(100).optional(),
  is_pinned: z.boolean().optional(),
});

router.patch("/:id", requireAuth, requireRole([...HR_ROLES]),
  validate(UpdateSchema),
  async (req: AuthRequest, res: Response) => {
    const item = await repo.updateAnnouncement(req.params.id, req.body);
    if (!item) throw notFound("Announcement not found");
    res.json({ announcement: item });
  }
);

// ─── DELETE /api/announcements/:id — delete (hr_admin only) ───────────────────
router.delete("/:id", requireAuth, requireRole([...HR_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const deleted = await repo.deleteAnnouncement(req.params.id);
    if (!deleted) throw notFound("Announcement not found");
    res.status(204).send();
  }
);

// ─── POST /api/announcements/:id/reactions — upsert (all auth) ────────────────
const ReactionSchema = z.object({
  reactionType: z.enum(ALLOWED_REACTIONS),
});

router.post("/:id/reactions", requireAuth,
  validate(ReactionSchema),
  async (req: AuthRequest, res: Response) => {
    const post = await repo.findById(req.params.id);
    if (!post) throw notFound("Announcement not found");
    await repo.upsertReaction(req.params.id, req.user!.entra_oid, req.body.reactionType);
    const summary = await repo.getReactionSummary(req.params.id);
    res.json({ reactions: summary });
  }
);

// ─── DELETE /api/announcements/:id/reactions — remove (all auth) ──────────────
router.delete("/:id/reactions", requireAuth,
  async (req: AuthRequest, res: Response) => {
    const post = await repo.findById(req.params.id);
    if (!post) throw notFound("Announcement not found");
    await repo.removeReaction(req.params.id, req.user!.entra_oid);
    const summary = await repo.getReactionSummary(req.params.id);
    res.json({ reactions: summary });
  }
);

export default router;
