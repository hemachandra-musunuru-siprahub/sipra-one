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

// ─── GET /api/users — list all (admin and hr) ────────────────────────────────
router.get("/", requireAuth, requireRole([...ADMIN_ROLES, ...HR_ROLES]), async (req: AuthRequest, res: Response) => {
  const users = await repo.listUsers();
  res.json({ users });
});

// ─── GET /api/users/managers — Manager-role users only (picker) ──────────────
// Returns only active users with role = 'Manager', with optional ?search= filter.
// IMPORTANT: Must be declared BEFORE GET /:id to prevent route shadowing.
router.get("/managers", requireAuth, requireRole([...ADMIN_ROLES]), async (req: AuthRequest, res: Response) => {
  const search = (req.query.search as string) || undefined;
  const managers = await repo.listManagers(search);
  res.json({ managers });
});

// ─── GET /api/users/:id — view profile (authenticated, field-restricted) ─────
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await repo.getUserByOid(req.params.id);
  if (!user) throw notFound("User not found");

  const role = req.user!.role;
  // Non-admins get limited fields
  if (isAdmin(role)) {
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

// ─── PATCH /api/users/:id/manager — set manager (admin only) ─────────────────
// The selected manager MUST have role = 'Manager'. All other roles are rejected
// with HTTP 400 to prevent assignment of Admins / HR / Employees as managers.
const UpdateManagerSchema = z.object({
  managerEntraOid: z.string().nullable(),
});

router.patch("/:id/manager", requireAuth, requireRole([...ADMIN_ROLES]),
  validate(UpdateManagerSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { managerEntraOid } = req.body;

    if (managerEntraOid === req.params.id) {
      throw badRequest("A user cannot be their own manager");
    }

    // Validate: selected user must exist AND have role = 'Manager'
    if (managerEntraOid !== null) {
      const candidate = await repo.getUserByOid(managerEntraOid);
      if (!candidate) throw notFound("Selected user not found");
      if ((candidate as any).role !== "Manager") {
        res.status(400).json({
          error: "INVALID_MANAGER",
          message: "Selected user is not a manager",
        });
        return;
      }
    }

    const user = await repo.updateManager(req.params.id, managerEntraOid);
    if (!user) throw notFound("User not found");
    res.json({ user });
  }
);

// ─── PATCH /api/users/:id/active — activate/deactivate (admin only) ──────────
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
