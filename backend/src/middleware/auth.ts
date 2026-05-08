import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { query } from "../db";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_change_me";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    entra_oid: string;
    email: string;
    name: string;
    role: string;            // Canonical role from the database ("Admin" | "HR" | "Manager" | "Employee")
    manager_entra_oid?: string;
    is_active: boolean;
  };
}

// ─── In-memory user cache ─────────────────────────────────────────────────────
// Caches the DB user row for 60 seconds per entra_oid so that every protected
// API call does NOT hit the database.  TTL keeps it fresh for role changes.
const USER_CACHE_TTL_MS = 60_000; // 60 seconds

interface CachedUser {
  user: AuthRequest["user"];
  expiresAt: number;
}

const userCache = new Map<string, CachedUser>();

export const invalidateUserCache = (entra_oid: string) => {
  userCache.delete(entra_oid);
};

const getCachedUser = (entra_oid: string): AuthRequest["user"] | null => {
  const entry = userCache.get(entra_oid);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    userCache.delete(entra_oid);
    return null;
  }
  return entry.user!;
};

const setCachedUser = (entra_oid: string, user: AuthRequest["user"]) => {
  userCache.set(entra_oid, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
};

// ─── requireAuth ──────────────────────────────────────────────────────────────
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const cookies = req.cookies || {};
  const token = cookies.session_token;

  if (!token) {
    console.warn(`[AUTH] 401 - No session_token cookie on ${req.method} ${req.path}.`);
    res.status(401).json({ error: "Unauthorized: No session token provided" });
    return;
  }

  let userRow: AuthRequest["user"];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { entra_oid: string };

    // ── Check cache first ──
    const cached = getCachedUser(decoded.entra_oid);
    if (cached) {
      req.user = cached;
      return next();
    }

    // ── Cache miss: fetch identity + role from DB ──
    const { rows } = await query(
      "SELECT id, entra_oid, email, name, role, manager_entra_oid, is_active FROM users WHERE entra_oid = $1 AND is_active = true",
      [decoded.entra_oid]
    );

    if (rows.length === 0) {
      console.warn(`[AUTH] 401 - User ${decoded.entra_oid} not found in DB or is inactive`);
      res.status(401).json({ error: "Unauthorized: User not found or inactive" });
      return;
    }

    userRow = rows[0] as NonNullable<AuthRequest["user"]>;
    console.log(`[AUTH] ✓ Authenticated ${userRow.name} (${userRow.role}) on ${req.method} ${req.path}`);
    setCachedUser(decoded.entra_oid, userRow);
  } catch (err: any) {
    console.warn(`[AUTH] 401 - JWT verification failed on ${req.method} ${req.path}: ${err.message}`);
    res.status(401).json({ error: "Unauthorized: Invalid or expired session token" });
    return;
  }

  req.user = userRow;
  next();
};

// ─── requireRole ──────────────────────────────────────────────────────────────
// allowedRoles should be one of the role constants from lib/roles.ts.
// Admin always passes regardless of the allowed list.
export const requireRole = (allowedRoles: readonly string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized: No user session" });
      return;
    }
    const userRole = req.user.role;
    const hasAccess = userRole === "Admin" || (allowedRoles as string[]).includes(userRole);
    if (!hasAccess) {
      res.status(403).json({ error: "Forbidden: Insufficient permissions" });
      return;
    }
    next();
  };
};

// Safely extract a single string param under Express 5 (params can be string | string[])
export const getParam = (req: Request, key: string): string => {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : val;
};
