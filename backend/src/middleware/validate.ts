import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export const validate = (schema: ZodSchema, source: "body" | "query" | "params" = "body") =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Input validation failed",
        details: result.error.flatten(),
      });
      return;
    }
    req[source] = result.data;
    next();
  };
