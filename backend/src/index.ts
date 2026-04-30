import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

// ─── Validate required env vars ───────────────────────────────────────────────
const required = ["ENTRA_TENANT_ID", "ENTRA_CLIENT_ID", "DATABASE_URL"];
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
import adminRoutes       from "./services/admin/routes";

const app = express();

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

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Endpoint not found" });
});

// ─── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`🚀 SipraHub backend running on port ${PORT}`);
  logger.info(`   Tenant:   ${process.env.ENTRA_TENANT_ID}`);
  logger.info(`   Frontend: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
});

