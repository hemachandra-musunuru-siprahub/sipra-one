import http from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

// ─── Validate required env vars ───────────────────────────────────────────────
const required = ["ENTRA_TENANT_ID", "ENTRA_CLIENT_ID", "DATABASE_URL", "ENTRA_CLIENT_SECRET"];
console.log("--------------------------------------------------");
console.log("SipraHub Backend Startup: Environment Check");
console.log(`ENTRA_TENANT_ID exists: ${!!process.env.ENTRA_TENANT_ID}`);
console.log(`ENTRA_CLIENT_ID exists: ${!!process.env.ENTRA_CLIENT_ID}`);
console.log(`ENTRA_CLIENT_SECRET exists: ${!!process.env.ENTRA_CLIENT_SECRET && process.env.ENTRA_CLIENT_SECRET !== "your_client_secret_if_used"}`);
if (process.env.ENTRA_CLIENT_SECRET && process.env.ENTRA_CLIENT_SECRET !== "your_client_secret_if_used") {
  console.log(`ENTRA_CLIENT_SECRET length: ${process.env.ENTRA_CLIENT_SECRET.length}`);
}
console.log("--------------------------------------------------");

for (const key of required) {
  if (!process.env[key] || process.env[key]!.includes("your_")) {
    console.error(`❌ STARTUP ERROR: ${key} is missing or invalid in .env`);
    process.exit(1);
  }
}

import { logger } from "./lib/logger";
import { errorHandler } from "./lib/errors";
import { requestId } from "./middleware/requestId";
import { query } from "./db";

// ─── Route imports ────────────────────────────────────────────────────────────
import authRoutes        from "./services/auth/routes";
import userRoutes        from "./services/users/routes";
import announcementRoutes from "./services/announcements/routes";
import timesheetRoutes   from "./services/timesheets/routes";
import leaveRoutes       from "./services/leave/routes";
import hrDocumentRoutes  from "./services/hr-documents/routes";
import searchRoutes      from "./services/search/routes";
import performanceRoutes from "./services/performance/routes";
import adminRoutes         from "./services/admin/routes";
import managerRoutes       from "./services/manager/routes";
import employeeRoutes      from "./services/employee/routes";
import notificationRoutes  from "./services/notifications/routes";

const app = express();
const httpServer = http.createServer(app);

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
app.use(requestId);
app.use(express.static("public"));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",           authRoutes);
app.use("/api/users",          userRoutes);
app.use("/api/announcements",  announcementRoutes);
app.use("/api/timesheets",     timesheetRoutes);
app.use("/api/leave-requests", leaveRoutes);
app.use("/api/hr-documents",   hrDocumentRoutes);
app.use("/api/search",         searchRoutes);
app.use("/api/performance",    performanceRoutes);
app.use("/api/admin",          adminRoutes);
app.use("/api/manager",        managerRoutes);
app.use("/api/employee",       employeeRoutes);
app.use("/api/notifications",  notificationRoutes);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Endpoint not found" });
});

// ─── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

httpServer.listen(PORT, () => {
  logger.info(`🚀 SipraHub backend running on port ${PORT}`);
  logger.info(`   Tenant:   ${process.env.ENTRA_TENANT_ID}`);
  logger.info(`   Frontend: ${FRONTEND_URL}`);
});

