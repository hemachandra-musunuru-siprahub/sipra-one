import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../../middleware/auth";
import * as repo from "./repo";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const q = ((req.query.q as string) || "").trim();
  if (q.length < 2) {
    return res.json({ query: q, announcements: [], employees: [], documents: [], totalCount: 0 });
  }
  const capped = q.slice(0, 100);
  const results = await repo.searchAll(capped, req.user!.entra_oid);
  res.json(results);
});

export default router;
