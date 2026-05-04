import { Router, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { notFound, forbidden } from "../../lib/errors";
import { HR_ROLES, ADMIN_ROLES } from "../../lib/roles";
import * as repo from "./repo";

const router = Router();

// ─── GET / — Employee/manager/HR sees scoped documents ────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const docs = await repo.listDocuments(req.user!.entra_oid);
  res.json({ documents: docs });
});

// ─── GET /all — HR/Admin sees everything they've shared ───────────────────────
router.get("/all", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const docs = await repo.listAllDocuments();
    res.json({ documents: docs });
  }
);

// ─── GET /:id ─────────────────────────────────────────────────────────────────
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const doc = await repo.findById(req.params.id, req.user!.entra_oid);
  if (!doc) throw notFound("Document not found or not accessible");
  res.json({ document: doc });
});

const CreateDocSchema = z.object({
  title:        z.string().min(1).max(255),
  description:  z.string().optional(),
  documentType: z.string().min(1).max(100),
  scope:        z.enum(["company", "individual"]),
  onedriveUrl:  z.string().url(),
  assignedToOid: z.string().optional(),
}).refine(d => d.scope !== "individual" || !!d.assignedToOid, {
  message: "assignedToOid is required for individual documents",
});

router.post("/", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  validate(CreateDocSchema),
  async (req: AuthRequest, res: Response) => {
    const { title, description, documentType, scope, onedriveUrl, assignedToOid } = req.body;
    const doc = await repo.createDocument(
      title, documentType, scope, onedriveUrl, req.user!.entra_oid, description, assignedToOid
    );
    res.status(201).json({ document: doc });
  }
);

// ─── POST /share — HR browses OneDrive and shares with 1..N employees ─────────
const ShareDocSchema = z.object({
  fileName:      z.string().min(1).max(255),
  onedriveUrl:   z.string().url(),
  driveItemId:   z.string().optional(),
  documentType:  z.string().min(1).max(100).default("Shared Document"),
  description:   z.string().optional(),
  recipientOids: z.array(z.string().min(1)).min(1, "At least one recipient is required"),
});

router.post("/share", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  validate(ShareDocSchema),
  async (req: AuthRequest, res: Response) => {
    const { fileName, onedriveUrl, documentType, description, recipientOids } = req.body;
    const sharedByOid = req.user!.entra_oid;

    // Create one document record per recipient (individual scope for tracking)
    const docs = await repo.shareDocumentWithEmployees(
      fileName, documentType, onedriveUrl, sharedByOid, recipientOids, description
    );
    res.status(201).json({ documents: docs });
  }
);

const UpdateDocSchema = z.object({
  title:        z.string().min(1).max(255).optional(),
  description:  z.string().optional(),
  onedrive_url: z.string().url().optional(),
  scope:        z.enum(["company", "individual"]).optional(),
  assigned_to_oid: z.string().optional(),
});

router.patch("/:id", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  validate(UpdateDocSchema),
  async (req: AuthRequest, res: Response) => {
    const doc = await repo.findByIdAdmin(req.params.id);
    if (!doc) throw notFound("Document not found");
    const updated = await repo.updateDocument(req.params.id, req.body);
    res.json({ document: updated });
  }
);

router.delete("/:id", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const deleted = await repo.deleteDocument(req.params.id);
    if (!deleted) throw notFound("Document not found");
    res.status(204).send();
  }
);

export default router;

