import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import { query } from "./db";

dotenv.config();

const ENTRA_TENANT_ID = process.env.ENTRA_TENANT_ID;
const ENTRA_CLIENT_ID = process.env.ENTRA_CLIENT_ID;

if (!ENTRA_TENANT_ID || ENTRA_TENANT_ID === "undefined" || ENTRA_TENANT_ID.includes("your_")) {
  console.error("❌ STARTUP ERROR: ENTRA_TENANT_ID is missing or invalid in backend/.env");
  process.exit(1);
}

if (!ENTRA_CLIENT_ID || ENTRA_CLIENT_ID === "undefined" || ENTRA_CLIENT_ID.includes("your_")) {
  console.error("❌ STARTUP ERROR: ENTRA_CLIENT_ID is missing or invalid in backend/.env");
  process.exit(1);
}

console.log("=========================================");
console.log("🚀 Server Configuration Verified:");
console.log(`- ENTRA_TENANT_ID: ${ENTRA_TENANT_ID}`);
console.log(`- ENTRA_CLIENT_ID: ${ENTRA_CLIENT_ID}`);
console.log(`- JWKS URI: https://login.microsoftonline.com/${ENTRA_TENANT_ID}/discovery/v2.0/keys`);
console.log(`- FRONTEND_URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
console.log("=========================================");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);

import { requireAuth, requireRole } from "./middleware/auth";

// Protected HR Routes
app.get("/api/hr/documents", requireAuth, requireRole(["SipraHub-HR"]), (req, res) => {
  res.json({ message: "HR document data accessed securely" });
});

// Protected Manager Routes
app.get("/api/manager/approvals", requireAuth, requireRole(["SipraHub-Manager"]), (req, res) => {
  res.json({ message: "Manager approvals accessed securely" });
});

// Protected SystemAdmin Routes
app.get("/api/admin/users", requireAuth, requireRole(["SipraHub-SystemAdmin"]), (req, res) => {
  res.json({ message: "System Admin user management accessed securely" });
});

// HR Check Route
app.get("/api/hr-check", requireAuth, (req, res) => {
  const userRoles = (req as any).user?.roles || [];
  if (!userRoles.includes("SipraHub-HR") && !userRoles.includes("HR")) {
    return res.status(403).json({ message: "Access Denied" });
  }
  res.json({ message: "HR Access Success" });
});

// Employee Check Route
app.get("/api/employee-check", requireAuth, (req, res) => {
  const userRoles = (req as any).user?.roles || [];
  if (!userRoles.includes("SipraHub-Employee") && !userRoles.includes("Employee")) {
    return res.status(403).json({ message: "Access Denied" });
  }
  res.json({ message: "Employee Access Success" });
});

// Manager Check Route
app.get("/api/manager-check", requireAuth, (req, res) => {
  const userRoles = (req as any).user?.roles || [];
  if (!userRoles.includes("SipraHub-Manager") && !userRoles.includes("Manager")) {
    return res.status(403).json({ message: "Access Denied" });
  }
  res.json({ message: "Manager Access Success" });
});

// Admin Check Route
app.get("/api/admin-check", requireAuth, requireRole(["Admin", "SipraHub-SystemAdmin"]), (req, res) => {
  res.json({ message: "Admin Access Success" });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Check Endpoints
// These validate role access for each dashboard page.
// Admins bypass all role restrictions (top-level access).
// ─────────────────────────────────────────────────────────────────────────────

const isAdmin = (roles: string[]): boolean =>
  roles.includes("Admin") || roles.includes("SipraHub-SystemAdmin");

// GET /api/manager-dashboard-check
app.get("/api/manager-dashboard-check", requireAuth, (req, res) => {
  const userRoles: string[] = (req as any).user?.roles || [];
  if (!isAdmin(userRoles) && !userRoles.includes("SipraHub-Manager") && !userRoles.includes("Manager")) {
    return res.status(403).json({ message: "Access Denied" });
  }
  res.json({ message: "Access Success" });
});

// GET /api/hr-dashboard-check
app.get("/api/hr-dashboard-check", requireAuth, (req, res) => {
  const userRoles: string[] = (req as any).user?.roles || [];
  if (!isAdmin(userRoles) && !userRoles.includes("SipraHub-HR") && !userRoles.includes("HR")) {
    return res.status(403).json({ message: "Access Denied" });
  }
  res.json({ message: "Access Success" });
});

// GET /api/employee-dashboard-check
app.get("/api/employee-dashboard-check", requireAuth, (req, res) => {
  const userRoles: string[] = (req as any).user?.roles || [];
  const hasEmployeeAccess =
    isAdmin(userRoles) ||
    userRoles.includes("SipraHub-Employee") ||
    userRoles.includes("Employee") ||
    userRoles.includes("Default Access");
  if (!hasEmployeeAccess) {
    return res.status(403).json({ message: "Access Denied" });
  }
  res.json({ message: "Access Success" });
});

// ─────────────────────────────────────────────────────────────────────────────
// Performance Endpoints
// ─────────────────────────────────────────────────────────────────────────────

// Employee: My Performance
app.get("/api/performance/me", requireAuth, async (req, res) => {
  const user = (req as any).user;
  try {
    const goals = await query("SELECT * FROM performance_goals WHERE employee_oid = $1 ORDER BY created_at DESC", [user.entra_oid]);
    const reviews = await query("SELECT * FROM performance_reviews WHERE employee_oid = $1 ORDER BY created_at DESC", [user.entra_oid]);
    
    res.json({
      goals: goals.rows,
      reviews: reviews.rows
    });
  } catch (error) {
    console.error("Error fetching performance data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Manager: Team Performance
app.get("/api/performance/team", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const userRoles: string[] = user?.roles || [];
  
  if (!isAdmin(userRoles) && !userRoles.includes("SipraHub-Manager") && !userRoles.includes("Manager")) {
    return res.status(403).json({ message: "Access Denied" });
  }

  try {
    // If Admin, they might want all performance data or just their team. 
    // For now, let's keep it to their direct report data (where they are manager/reviewer)
    const goals = await query(
      "SELECT g.*, u.name as employee_name FROM performance_goals g JOIN users u ON g.employee_oid = u.entra_oid WHERE g.manager_oid = $1 ORDER BY g.created_at DESC", 
      [user.entra_oid]
    );
    const reviews = await query(
      "SELECT r.*, u.name as employee_name FROM performance_reviews r JOIN users u ON r.employee_oid = u.entra_oid WHERE r.reviewer_oid = $1 ORDER BY r.created_at DESC", 
      [user.entra_oid]
    );
    
    res.json({
      teamGoals: goals.rows,
      teamReviews: reviews.rows
    });
  } catch (error) {
    console.error("Error fetching team performance data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Manager: Create Goal
app.post("/api/performance/goal", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const userRoles: string[] = user?.roles || [];
  
  if (!isAdmin(userRoles) && !userRoles.includes("SipraHub-Manager") && !userRoles.includes("Manager")) {
    return res.status(403).json({ message: "Access Denied" });
  }

  const { employee_oid, title, description, target_date } = req.body;

  try {
    const result = await query(
      "INSERT INTO performance_goals (employee_oid, manager_oid, title, description, target_date, status, progress_percent) VALUES ($1, $2, $3, $4, $5, 'pending', 0) RETURNING *",
      [employee_oid, user.entra_oid, title, description, target_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating goal:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Manager: Create Review
app.post("/api/performance/review", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const userRoles: string[] = user?.roles || [];
  
  if (!isAdmin(userRoles) && !userRoles.includes("SipraHub-Manager") && !userRoles.includes("Manager")) {
    return res.status(403).json({ message: "Access Denied" });
  }

  const { employee_oid, review_period, rating, strengths, improvements, comments } = req.body;

  try {
    const result = await query(
      "INSERT INTO performance_reviews (employee_oid, reviewer_oid, review_period, rating, strengths, improvements, comments) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [employee_oid, user.entra_oid, review_period, rating, strengths, improvements, comments]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// HR: Performance Reports
app.get("/api/performance/reports", requireAuth, async (req, res) => {
  const userRoles: string[] = (req as any).user?.roles || [];
  if (!isAdmin(userRoles) && !userRoles.includes("SipraHub-HR") && !userRoles.includes("HR")) {
    return res.status(403).json({ message: "Access Denied" });
  }

  try {
    // Aggregated reports for HR
    const ratingStats = await query("SELECT rating, COUNT(*) as count FROM performance_reviews GROUP BY rating ORDER BY rating DESC");
    const completionStats = await query(`
      SELECT 
        u.name, 
        COUNT(r.id) as review_count 
      FROM users u 
      LEFT JOIN performance_reviews r ON u.entra_oid = r.employee_oid 
      GROUP BY u.entra_oid, u.name
    `);
    
    res.json({
      ratingDistribution: ratingStats.rows,
      completionByEmployee: completionStats.rows
    });
  } catch (error) {
    console.error("Error fetching performance reports:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
