import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../../middleware/auth";
import * as repo from "./repo";
import { notFound } from "../../lib/errors";
import { getSocketServer } from "../../lib/socketServer";

const router = Router();

// ─── GET /api/notifications ──────────────────────────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await repo.listForUser(req.user!.entra_oid);
    const unread = await repo.unreadCount(req.user!.entra_oid);
    res.json({ notifications, unread_count: unread });
  } catch (error: any) {
    console.error("[NOTIFICATIONS API ERROR]:", error);
    res.status(500).json({ error: "INTERNAL_ERROR", details: error.message });
  }
});

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────
router.patch("/:id/read", requireAuth, async (req: AuthRequest, res: Response) => {
  const updated = await repo.markRead(req.params.id, req.user!.entra_oid);
  if (!updated) throw notFound("Notification not found");
  // Push updated unread count via WebSocket
  const io = getSocketServer();
  if (io) {
    const unread = await repo.unreadCount(req.user!.entra_oid);
    io.to(`user:${req.user!.entra_oid}`).emit("unread_count", { count: unread });
  }
  res.json({ notification: updated });
});

// ─── PATCH /api/notifications/read-all ───────────────────────────────────────
router.patch("/read-all", requireAuth, async (req: AuthRequest, res: Response) => {
  await repo.markAllRead(req.user!.entra_oid);
  const io = getSocketServer();
  if (io) {
    io.to(`user:${req.user!.entra_oid}`).emit("unread_count", { count: 0 });
  }
  res.json({ success: true });
});

export default router;
