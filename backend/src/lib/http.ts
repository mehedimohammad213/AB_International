import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  status: number;
  extra: Record<string, unknown>;

  constructor(status: number, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function needConfirm(confirm: string, message: string): never {
  throw new HttpError(409, message, { confirm });
}

export function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function operatorName(req: Request) {
  const fromUser = req.user?.displayName?.trim();
  if (fromUser) return fromUser.slice(0, 80);
  const raw = String(req.header("x-operator") || "Operator").trim();
  return raw.slice(0, 80) || "Operator";
}

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    res.status(400).json({ error: error.issues.map((issue) => issue.message).join(" ") });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, ...error.extra });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server." });
}
