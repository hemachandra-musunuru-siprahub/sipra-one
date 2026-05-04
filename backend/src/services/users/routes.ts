import { Router, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { notFound, forbidden, badRequest } from "../../lib/errors";
import { isAdmin, ADMIN_ROLES, HR_ROLES } from "../../lib/roles";
import * as repo from "./repo";
import * as hrRepo from "../hr-documents/repo";
import * as annRepo from "../announcements/repo";
import * as leaveRepo from "../leave/repo";

const router = Router();

// ─── GET /api/users/dashboard — unified summary for dashboard ─────────────────
router.get("/dashboard", requireAuth, async (req: AuthRequest, res: Response) => {
  const oid = req.user!.entra_oid;
  const currentYear = new Date().getFullYear();

  try {
    const [docCount, annCount, leaveBalances] = await Promise.all([
      hrRepo.countDocuments(oid),
      annRepo.countAnnouncements(),
      leaveRepo.getBalances(oid, currentYear),
    ]);

    res.json({
      counts: {
        documents: docCount,
        announcements: annCount,
      },
      leaveBalances,
    });
  } catch (error: any) {
    console.error("Dashboard data error:", error);
    res.status(500).json({ error: "INTERNAL_ERROR", details: error.message });
  }
});

// ─── GET /api/users — list all (admin and hr) ───────────────────────────────────
router.get("/", requireAuth, requireRole([...ADMIN_ROLES, ...HR_ROLES]), async (req: AuthRequest, res: Response) => {
  console.log("Fetching users. User roles:", req.user?.roles);
  const users = await repo.listUsers();
  res.json({ users });
});

// ─── GET /api/users/:id — view profile (authenticated, field-restricted) ──────
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await repo.getUserByOid(req.params.id);
  if (!user) throw notFound("User not found");

  const roles = req.user!.roles || [];
  // Non-admins get limited fields
  if (isAdmin(roles)) {
    res.json({ user });
  } else {
    res.json({
      user: {
        entra_oid: user.entra_oid,
        name: user.name,
        email: user.email,
        is_active: user.is_active,
      },
    });
  }
});

// ─── PATCH /api/users/:id/manager — set manager (admin only) ──────────────────
const UpdateManagerSchema = z.object({
  managerEntraOid: z.string().nullable(),
});

router.patch("/:id/manager", requireAuth, requireRole([...ADMIN_ROLES]),
  validate(UpdateManagerSchema),
  async (req: AuthRequest, res: Response) => {
    const { managerEntraOid } = req.body;
    if (managerEntraOid === req.params.id) throw badRequest("A user cannot be their own manager");
    const user = await repo.updateManager(req.params.id, managerEntraOid);
    if (!user) throw notFound("User not found");
    res.json({ user });
  }
);

// ─── PATCH /api/users/:id/active — activate/deactivate (admin only) ───────────
const UpdateActiveSchema = z.object({
  isActive: z.boolean(),
});

router.patch("/:id/active", requireAuth, requireRole([...ADMIN_ROLES]),
  validate(UpdateActiveSchema),
  async (req: AuthRequest, res: Response) => {
    const actorOid = req.user!.entra_oid;
    if (req.params.id === actorOid) throw badRequest("You cannot deactivate your own account");
    const user = await repo.updateActiveState(req.params.id, req.body.isActive);
    if (!user) throw notFound("User not found");
    res.json({ user });
  }
);

export default router;
