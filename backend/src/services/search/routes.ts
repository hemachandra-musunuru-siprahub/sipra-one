import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../../middleware/auth";
import * as repo from "./repo";

const router = Router();

/**
 * GET /api/search?q=...
 * Global search endpoint.
 * Returns { employees: [], announcements: [], hr_documents: [] }
 */
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const q = ((req.query.q as string) || "").trim();

    // Empty results if query < 2 chars
    if (q.length < 2) {
      return res.json({ 
        employees: [], 
        announcements: [], 
        hr_documents: [] 
      });
    }

    // Call repo search (parallel PG full-text)
    const results = await repo.searchAll(q, req.user!.entra_oid);
    
    res.json(results);
  } catch (error: any) {
    console.error("[SEARCH] Error:", error);
    res.status(500).json({ error: "SEARCH_FAILED", details: error.message });
  }
});

export default router;
