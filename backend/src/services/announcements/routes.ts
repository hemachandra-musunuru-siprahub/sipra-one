import { Router, Response } from "express";
import { AppError } from "../../lib/errors";
import { z } from "zod";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { notFound, forbidden } from "../../lib/errors";
import { isAdmin, isHR, HR_ROLES } from "../../lib/roles";
import * as repo from "./repo";
import { processBase64Image } from "../../lib/imageUtils";
import { logger } from "../../lib/logger";
import * as notifRepo from "../notifications/repo";
import { emitNotification, getSocketServer } from "../../lib/socketServer";
import { query } from "../../db";

const router = Router();

const ALLOWED_REACTIONS = ["thumbs_up", "heart", "laugh", "surprised", "sad"] as const;
const ALLOWED_CATEGORIES = ["HR", "Company Events", "General Updates"] as const;

// ─── GET /api/announcements — paginated feed ───────────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit  = Math.min(50, parseInt(req.query.limit as string) || 20);
    const latest = req.query.latest === "true";
    const status = (req.query.status as string) || "published";
    console.log(`[GET /api/announcements] page=${page} limit=${limit} latest=${latest} status=${status}`);
    const items  = await repo.getFeed(page, limit, req.user!.entra_oid, latest, status);
    console.log(`[GET /api/announcements] Fetched ${items.length} announcements with status=${status}`);
    res.json({ announcements: items, page, limit });
  } catch (err: any) {
    logger.error({ err, path: "/api/announcements" }, "Failed to fetch announcements feed");
    console.error("[GET /api/announcements] SQL Error:", err.message, err.detail || "");
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to load announcements",
      details: err.message,
    });
  }
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
  category:  z.enum(ALLOWED_CATEGORIES).nullable().optional(),
  type:      z.enum(["GENERAL", "IMPORTANT"]).default("GENERAL"),
  priority:  z.enum(["low", "medium", "high"]).optional(), // backward compat
  is_pinned: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
  image_url: z.string().nullable().optional(),
  status:    z.enum(["draft", "published"]).default("published"),
});

router.post("/", requireAuth, requireRole([...HR_ROLES]),
  validate(CreateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      logger.info({ user: req.user?.entra_oid }, "Creating announcement");
      let { title, body, category, is_pinned, type, priority, image_url, status } = req.body;
      
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

      console.log(`[POST /api/announcements] Submitting: title=${title} status=${status}`);
      
      const item = await repo.createAnnouncement(
        title, 
        body, 
        category, 
        is_pinned, 
        dbPriority, 
        image_url, 
        req.user!.entra_oid,
        status || "published"
      );
      
      res.status(201).json({ announcement: item });

      // ── Fan-out notification to all active users (fire-and-forget) ─────
      try {
        if (item.status === "published" || item.status === "pinned") {
          const { rows } = await query(`SELECT entra_oid FROM users WHERE is_active = true`);
          let recipientOids: string[] = rows.map((r: any) => r.entra_oid);
          
          // Filter out the HR user who created it
          recipientOids = recipientOids.filter(oid => oid !== req.user!.entra_oid);

          if (recipientOids.length > 0) {
            const notifTitle = type === "IMPORTANT" ? `🚨 ${title}` : `📢 ${title}`;
            const notifMsg = `New announcement: ${body.slice(0, 120)}${body.length > 120 ? "..." : ""}`;
            const notifications = await notifRepo.createNotifications(
              recipientOids, "announcement", notifTitle, notifMsg, "announcement", item.id
            );
            notifications.forEach(n => emitNotification(n.recipient_oid, n));
            const io = getSocketServer();
            if (io) {
              for (const oid of recipientOids) {
                const count = await notifRepo.unreadCount(oid);
                io.to(`user:${oid}`).emit("unread_count", { count });
              }
            }
          }
        }
      } catch (nErr) {
        console.error("[NOTIF] Failed to send announcement notification:", nErr);
      }
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
  category:  z.enum(ALLOWED_CATEGORIES).nullable().optional(),
  type:      z.enum(["GENERAL", "IMPORTANT"]).optional(),
  priority:  z.enum(["low", "medium", "high"]).optional(), // backward compat
  is_pinned: z.preprocess((val) => val === "true" || val === true, z.boolean()).optional(),
  image_url: z.string().nullable().optional(),
  status:    z.enum(["draft", "published"]).optional(),
});

router.patch("/:id", requireAuth, requireRole([...HR_ROLES]),
  validate(UpdateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      let { title, body, category, is_pinned, type, priority, image_url, status } = req.body;
      
      // Backward compatibility mapping
      if (!type && priority) {
        type = priority === "high" ? "IMPORTANT" : "GENERAL";
      }

      // Map back to DB priority format
      const dbPriority = type === "IMPORTANT" ? "high" : "low";

      const fields: any = { title, body, category, is_pinned, priority: dbPriority, image_url, status };
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

      const oldItem = await repo.findById(req.params.id);
      if (!oldItem) throw notFound("Announcement not found");

      const item = await repo.updateAnnouncement(req.params.id, fields);
      if (!item) throw notFound("Announcement not found");
      res.json({ announcement: item });

      // ── Fan-out notification if transitioning from draft to published ─────
      try {
        if (oldItem.status === "draft" && (item.status === "published" || item.status === "pinned")) {
          const { rows } = await query(`SELECT entra_oid FROM users WHERE is_active = true`);
          let recipientOids: string[] = rows.map((r: any) => r.entra_oid);
          
          // Filter out the HR user who updated it
          recipientOids = recipientOids.filter(oid => oid !== req.user!.entra_oid);

          if (recipientOids.length > 0) {
            const notifTitle = item.priority === "high" ? `🚨 ${item.title}` : `📢 ${item.title}`;
            const notifMsg = `New announcement: ${item.body.slice(0, 120)}${item.body.length > 120 ? "..." : ""}`;
            const notifications = await notifRepo.createNotifications(
              recipientOids, "announcement", notifTitle, notifMsg, "announcement", item.id
            );
            notifications.forEach(n => emitNotification(n.recipient_oid, n));
            const io = getSocketServer();
            if (io) {
              for (const oid of recipientOids) {
                const count = await notifRepo.unreadCount(oid);
                io.to(`user:${oid}`).emit("unread_count", { count });
              }
            }
          }
        }
      } catch (nErr) {
        console.error("[NOTIF] Failed to send announcement notification on update:", nErr);
      }
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
    try {
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
      summary.forEach(r => { reactions_count[r.reaction_type] = r.count; });
      
      const newUserReaction = await repo.getUserReaction(req.params.id, req.user!.entra_oid);
      
      res.json({ 
        reactions_count, 
        user_reaction: newUserReaction 
      });
    } catch (err: any) {
      if (err instanceof AppError && err.statusCode === 404) {
        res.status(404).json({ error: "NOT_FOUND", message: err.message });
        return;
      }
      logger.error({ err, announcementId: req.params.id, userOid: req.user?.entra_oid }, "Database error updating reaction");
      console.error("[Reaction DB Error]:", err.message, err.detail || "");
      res.status(500).json({ error: "REACTION_FAILED", message: "Failed to save reaction. Please try again." });
    }
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
