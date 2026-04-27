import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";

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
  const userRoles = (req as any).user?.app_roles || [];
  if (!userRoles.includes("SipraHub-HR") && !userRoles.includes("HR")) {
    return res.status(403).json({ message: "Access Denied" });
  }
  res.json({ message: "HR Access Success" });
});

// Employee Check Route
app.get("/api/employee-check", requireAuth, (req, res) => {
  const userRoles = (req as any).user?.app_roles || [];
  if (!userRoles.includes("SipraHub-Employee") && !userRoles.includes("Employee")) {
    return res.status(403).json({ message: "Access Denied" });
  }
  res.json({ message: "Employee Access Success" });
});

// Manager Check Route
app.get("/api/manager-check", requireAuth, (req, res) => {
  const userRoles = (req as any).user?.app_roles || [];
  if (!userRoles.includes("SipraHub-Manager") && !userRoles.includes("Manager")) {
    return res.status(403).json({ message: "Access Denied" });
  }
  res.json({ message: "Manager Access Success" });
});

// Admin Check Route
app.get("/api/admin-check", requireAuth, requireRole(["Admin", "SipraHub-SystemAdmin"]), (req, res) => {
  res.json({ message: "Admin Access Success" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
