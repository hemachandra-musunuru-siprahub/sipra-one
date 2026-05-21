import { Router, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { notFound } from "../../lib/errors";
import { HR_ROLES, ADMIN_ROLES } from "../../lib/roles";
import * as repo from "./repo";
import { backfillLeaveCredits } from "../../jobs/backfillLeaveCredits";
import { recalculateLeaveCredits } from "../../jobs/recalculateLeaveCredits";

const router = Router();

// ─── GET /api/leave-policies  — list all active policies ─────────────────────
router.get("/", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (_req: AuthRequest, res: Response) => {
    const policies = await repo.getAllPolicies();
    res.json({ policies });
  }
);

// ─── GET /api/leave-policies/employees  — all employees with their policy ─────
router.get("/employees", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (_req: AuthRequest, res: Response) => {
    const employees = await repo.getAllEmployeePolicies();
    res.json({ employees });
  }
);

// ─── GET /api/leave-policies/employee/:oid  — policy for one employee ─────────
router.get("/employee/:oid", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const policy = await repo.getActivePolicyForEmployee(req.params.oid);
    res.json({ policy });
  }
);

// ─── POST /api/leave-policies/backfill/:oid  — apply missing past credits ──────
router.post("/backfill/:oid", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await backfillLeaveCredits(req.params.oid);
      res.json({ success: true, ...result });
    } catch (err: any) {
      const status = err.message === "Employee not found" ? 404
        : err.message.includes("no Date of Joining") ? 400 : 500;
      res.status(status).json({ error: "BACKFILL_ERROR", details: err.message });
    }
  }
);

// ─── POST /api/leave-policies/recalculate/:oid  — full reset + recompute ───────
// Removes all system-generated credits, then reapplies from scratch using the
// current rule (no credit in joining month). Safe: preserves manual HR adjustments.
router.post("/recalculate/:oid", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await recalculateLeaveCredits(req.params.oid);
      res.json({ success: true, ...result });
    } catch (err: any) {
      const status = err.message === "Employee not found" ? 404
        : err.message.includes("no Date of Joining") ? 400 : 500;
      res.status(status).json({ error: "RECALCULATE_ERROR", details: err.message });
    }
  }
);

// ─── GET /api/leave-policies/:id  — single policy ────────────────────────────
router.get("/:id", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const policy = await repo.getPolicyById(req.params.id);
    if (!policy) throw notFound("Leave policy not found");
    res.json({ policy });
  }
);

// ─── GET /api/leave-policies/:id/assignments  — who is on this policy ─────────
router.get("/:id/assignments", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const policy = await repo.getPolicyById(req.params.id);
    if (!policy) throw notFound("Leave policy not found");
    const assignments = await repo.getAssignmentsForPolicy(req.params.id);
    res.json({ assignments });
  }
);

// ─── POST /api/leave-policies  — create policy ───────────────────────────────
const CreatePolicySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().max(500).optional(),
  leave_type: z.enum(["casual", "sick", "annual"]).default("casual"),
  monthly_credit: z.number().positive("Monthly credit must be positive").max(31),
  carry_forward: z.boolean().default(true),
  expire_year_end: z.boolean().default(true),
});

router.post("/", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  validate(CreatePolicySchema),
  async (req: AuthRequest, res: Response) => {
    const policy = await repo.createPolicy({
      ...req.body,
      created_by_oid: req.user!.entra_oid,
    });
    res.status(201).json({ policy });
  }
);

// ─── PATCH /api/leave-policies/:id  — update policy ─────────────────────────
const UpdatePolicySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  monthly_credit: z.number().positive().max(31).optional(),
  carry_forward: z.boolean().optional(),
  expire_year_end: z.boolean().optional(),
});

router.patch("/:id", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  validate(UpdatePolicySchema),
  async (req: AuthRequest, res: Response) => {
    const existing = await repo.getPolicyById(req.params.id);
    if (!existing) throw notFound("Leave policy not found");
    const policy = await repo.updatePolicy(req.params.id, req.body);
    res.json({ policy });
  }
);

// ─── DELETE /api/leave-policies/:id  — soft-delete ───────────────────────────
router.delete("/:id", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const existing = await repo.getPolicyById(req.params.id);
    if (!existing) throw notFound("Leave policy not found");
    const policy = await repo.deletePolicy(req.params.id);
    res.json({ policy, message: "Policy deactivated successfully" });
  }
);

// ─── POST /api/leave-policies/:id/assign-all  — assign to everyone ────────────
router.post("/:id/assign-all", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const existing = await repo.getPolicyById(req.params.id);
    if (!existing) throw notFound("Leave policy not found");
    const count = await repo.assignPolicyToAll(req.params.id, req.user!.entra_oid);
    res.json({ success: true, assigned: count, message: `Policy assigned to ${count} employees` });
  }
);

// ─── POST /api/leave-policies/:id/assign  — assign to selected employees ──────
const AssignSchema = z.object({
  employeeOids: z.array(z.string().min(1)).min(1, "At least one employee required"),
});

router.post("/:id/assign", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  validate(AssignSchema),
  async (req: AuthRequest, res: Response) => {
    const existing = await repo.getPolicyById(req.params.id);
    if (!existing) throw notFound("Leave policy not found");
    const count = await repo.assignPolicyToEmployees(
      req.params.id,
      req.body.employeeOids,
      req.user!.entra_oid
    );
    res.json({ success: true, assigned: count, message: `Policy assigned to ${count} employee(s)` });
  }
);

// ─── DELETE /api/leave-policies/:id/assign/:oid  — remove one employee ────────
router.delete("/:id/assign/:oid", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const result = await repo.removeEmployeeFromPolicy(req.params.id, req.params.oid);
    res.json({ success: true, result });
  }
);

export default router;
