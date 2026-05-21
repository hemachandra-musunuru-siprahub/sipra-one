import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

// ─── Standard Error Codes ────────────────────────────────────────────────────
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATUS"
  | "NO_MANAGER_ASSIGNED"
  | "INSUFFICIENT_BALANCE"
  | "INVALID_ROLE"
  | "USER_DEACTIVATED"
  | "DATABASE_ERROR"
  | "INTERNAL_SERVER_ERROR"
  | "EMPTY_TIMESHEET";

// ─── AppError Class ──────────────────────────────────────────────────────────
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: ErrorCode,
    message: string,
    public details?: object | string
  ) {
    super(message);
    this.name = "AppError";
  }
}

// ─── Convenience factories ───────────────────────────────────────────────────
export const notFound    = (msg = "Resource not found") => new AppError(404, "NOT_FOUND", msg);
export const forbidden   = (msg = "Access denied")      => new AppError(403, "FORBIDDEN", msg);
export const conflict    = (msg = "Resource conflict")  => new AppError(409, "CONFLICT", msg);
export const badRequest  = (msg: string, details?: object) => new AppError(400, "VALIDATION_ERROR", msg, details);
export const unprocessable = (code: ErrorCode, msg: string) => new AppError(422, code, msg);

// ─── Global Error Handler ────────────────────────────────────────────────────
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
  });
};
