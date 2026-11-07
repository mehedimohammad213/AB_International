import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { query } from "../db";
import { HttpError } from "./http";

export type AuthUser = {
  id: number;
  username: string;
  displayName: string;
};

type JwtPayload = {
  sub: number;
  username: string;
  displayName: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function jwtSecret() {
  return process.env.JWT_SECRET || "ab-invoice-dev-secret-change-me";
}

export function signToken(user: AuthUser) {
  const payload: JwtPayload = {
    sub: user.id,
    username: user.username,
    displayName: user.displayName,
  };
  return jwt.sign(payload, jwtSecret(), { expiresIn: "12h" });
}

export function verifyToken(token: string): AuthUser {
  try {
    const payload = jwt.verify(token, jwtSecret()) as unknown as JwtPayload;
    return {
      id: Number(payload.sub),
      username: payload.username,
      displayName: payload.displayName,
    };
  } catch {
    throw new HttpError(401, "Invalid or expired token.");
  }
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function checkPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    next(new HttpError(401, "Authentication required."));
    return;
  }
  try {
    req.user = verifyToken(match[1].trim());
    next();
  } catch (error) {
    next(error);
  }
}

export async function ensureDefaultUser() {
  const existing = await query("SELECT id FROM users LIMIT 1");
  if (existing.rows[0]) return;

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const displayName = process.env.ADMIN_DISPLAY_NAME || "Administrator";
  const passwordHash = await hashPassword(password);
  await query(
    `INSERT INTO users (username, password_hash, display_name)
     VALUES ($1, $2, $3)`,
    [username, passwordHash, displayName]
  );
  console.log(`Created default user "${username}" (change ADMIN_PASSWORD in production).`);
}
