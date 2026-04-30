import { Router, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { notFound, forbidden } from "../../lib/errors";
import { isAdmin, isHR, HR_ROLES } from "../../lib/roles";
import * as repo from "./repo";
import { processBase64Image } from "../../lib/imageUtils";
import { logger } from "../../lib/logger";

const router = Router();

const ALLOWED_REACTIONS = ["thumbs_up", "heart", "laugh", "surprised", "sad"] as const;

// ─── GET /api/announcements — paginated feed ───────────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const page   = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit  = Math.min(50, parseInt(req.query.limit as string) || 20);
  const latest = req.query.latest === "true";
  const items  = await repo.getFeed(page, limit, req.user!.entra_oid, latest);
  res.json({ announcements: items, page, limit });
});

// ─── GET /api/announcements/:id — single item ─────────────────────────────────
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const item = await repo.findById(req.params.id, req.user!.entra_oid);
  if (!item) throw notFound("Announcement not found");
  res.json({ announcement: item });
});

// ─── POST /api/announcements — create (hr_admin only) ────────────────────────
const CreateSchema = z.object({
  title:     z.string().min(1, "Title is required").max(255),
  body:      z.string().min(1, "Body is required"),
  category:  z.string().max(100).nullable().optional(),
  type:      z.enum(["GENERAL", "IMPORTANT"]).default("GENERAL"),
  priority:  z.enum(["low", "medium", "high"]).optional(), // backward compat
  is_pinned: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
  image_url: z.string().nullable().optional(),
});

router.post("/", requireAuth, requireRole([...HR_ROLES]),
  validate(CreateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      logger.info({ user: req.user?.entra_oid }, "Creating announcement");
      let { title, body, category, is_pinned, type, priority, image_url } = req.body;
      
      // Backward compatibility mapping
      if (!type && priority) {
        type = priority === "high" ? "IMPORTANT" : "GENERAL";
      }
      if (!type) type = "GENERAL";
      
      // Process image safely
      if (image_url) {
        try {
          image_url = processBase64Image(image_url);
        } catch (imgError: any) {
          logger.error({ err: imgError }, "Image processing failed");
          return res.status(400).json({ 
            error: "IMAGE_PROCESSING_FAILED", 
            message: "Failed to process image upload", 
            details: imgError.message 
          });
        }
      }
      
      // Map back to DB priority format to satisfy existing constraints
      const dbPriority = type === "IMPORTANT" ? "high" : "low";

      const item = await repo.createAnnouncement(
        title, 
        body, 
        category, 
        is_pinned, 
        dbPriority, 
        image_url, 
        req.user!.entra_oid
      );
      
      res.status(201).json({ announcement: item });
    } catch (err: any) {
      logger.error({ err }, "Error creating announcement");
      console.error(err);
      res.status(500).json({ 
        error: "INTERNAL_SERVER_ERROR", 
        message: err.message || "An unexpected error occurred while creating the announcement",
        details: err.detail || err.stack
      });
    }
  }
);

// ─── PATCH /api/announcements/:id — edit (hr_admin only) ──────────────────────
const UpdateSchema = z.object({
  title:     z.string().min(1).max(255).optional(),
  body:      z.string().min(1).optional(),
  category:  z.string().max(100).nullable().optional(),
  type:      z.enum(["GENERAL", "IMPORTANT"]).optional(),
  priority:  z.enum(["low", "medium", "high"]).optional(), // backward compat
  is_pinned: z.preprocess((val) => val === "true" || val === true, z.boolean()).optional(),
  image_url: z.string().nullable().optional(),
});

router.patch("/:id", requireAuth, requireRole([...HR_ROLES]),
  validate(UpdateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      let { title, body, category, is_pinned, type, priority, image_url } = req.body;
      
      // Backward compatibility mapping
      if (!type && priority) {
        type = priority === "high" ? "IMPORTANT" : "GENERAL";
      }

      // Map back to DB priority format
      const dbPriority = type === "IMPORTANT" ? "high" : "low";

      const fields: any = { title, body, category, is_pinned, priority: dbPriority, image_url };
      // Remove undefined fields
      Object.keys(fields).forEach(key => fields[key] === undefined && delete fields[key]);
      
      if (fields.image_url) {
        try {
          fields.image_url = processBase64Image(fields.image_url);
        } catch (imgError: any) {
          logger.error({ err: imgError }, "Image processing failed");
          return res.status(400).json({ 
            error: "IMAGE_PROCESSING_FAILED", 
            message: "Failed to process image upload", 
            details: imgError.message 
          });
        }
      }

      const item = await repo.updateAnnouncement(req.params.id, fields);
      if (!item) throw notFound("Announcement not found");
      res.json({ announcement: item });
    } catch (err: any) {
      if (err.status === 404) throw err; // Let global error handler catch 404s
      logger.error({ err }, "Error updating announcement");
      console.error(err);
      res.status(500).json({ 
        error: "INTERNAL_SERVER_ERROR", 
        message: err.message || "An unexpected error occurred while updating the announcement",
        details: err.detail || err.stack
      });
    }
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

// ─── POST /api/announcements/:id/reactions — toggle/replace (all auth) ────────
const ReactionSchema = z.object({
  reactionType: z.enum(ALLOWED_REACTIONS),
});

router.post("/:id/reactions", requireAuth,
  validate(ReactionSchema),
  async (req: AuthRequest, res: Response) => {
    const post = await repo.findById(req.params.id);
    if (!post) throw notFound("Announcement not found");
    
    // Check if we already have this reaction
    const currentReaction = await repo.getUserReaction(req.params.id, req.user!.entra_oid);
    
    if (currentReaction === req.body.reactionType) {
      // Same reaction -> remove (undo)
      await repo.removeReaction(req.params.id, req.user!.entra_oid);
    } else {
      // Different or none -> upsert
      await repo.upsertReaction(req.params.id, req.user!.entra_oid, req.body.reactionType);
    }

    const summary = await repo.getReactionSummary(req.params.id);
    const reactions_count: Record<string, number> = {};
    summary.forEach(r => { reactions_count[r.reaction_type] = parseInt(r.count); });
    
    const newUserReaction = await repo.getUserReaction(req.params.id, req.user!.entra_oid);
    
    res.json({ 
      reactions_count, 
      user_reaction: newUserReaction 
    });
  }
);

// ─── DELETE /api/announcements/:id/reactions — remove (all auth) ──────────────
router.delete("/:id/reactions", requireAuth,
  async (req: AuthRequest, res: Response) => {
    const post = await repo.findById(req.params.id);
    if (!post) throw notFound("Announcement not found");
    
    await repo.removeReaction(req.params.id, req.user!.entra_oid);
    const summary = await repo.getReactionSummary(req.params.id);
    const reactions_count: Record<string, number> = {};
    summary.forEach(r => { reactions_count[r.reaction_type] = parseInt(r.count); });
    
    res.json({ 
      reactions_count, 
      user_reaction: null 
    });
  }
);

export default router;
