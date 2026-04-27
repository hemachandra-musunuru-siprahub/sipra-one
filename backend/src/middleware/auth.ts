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
    roles: string[];
    manager_entra_oid?: string;
    is_active: boolean;
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.cookies.session_token;

  if (!token) {
    res.status(401).json({ error: "Unauthorized: No session token provided" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { entra_oid: string, roles: string[] };
    
    // Check if user exists and is active
    // Selected only essential profile cache fields
    const { rows } = await query(
      "SELECT id, entra_oid, email, name, manager_entra_oid, is_active FROM users WHERE entra_oid = $1 AND is_active = true", 
      [decoded.entra_oid]
    );
    
    if (rows.length === 0) {
      res.status(401).json({ error: "Unauthorized: User not found or inactive" });
      return;
    }

    // Attach user profile from DB + roles from session token
    req.user = {
      ...rows[0],
      roles: decoded.roles || []
    };
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized: Invalid or expired session token" });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized: No user session" });
      return;
    }

    const userRoles = req.user.roles || [];
    const hasRole = userRoles.some((role: string) => allowedRoles.includes(role));

    if (!hasRole) {
      res.status(403).json({ error: "Forbidden: Insufficient permissions" });
      return;
    }

    next();
  };
};
