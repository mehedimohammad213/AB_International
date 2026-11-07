import { Router } from "express";
import { z } from "zod";
import { camel, query } from "../db";
import { checkPassword, requireAuth, signToken } from "../lib/auth";
import { asyncRoute, HttpError } from "../lib/http";

const router = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

router.post(
  "/login",
  asyncRoute(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const result = await query(
      `SELECT id, username, password_hash, display_name
       FROM users WHERE username = $1`,
      [body.username]
    );
    const row = result.rows[0];
    if (!row) throw new HttpError(401, "Invalid username or password.");

    const user = camel<{
      id: number;
      username: string;
      passwordHash: string;
      displayName: string;
    }>(row);

    const ok = await checkPassword(body.password, user.passwordHash);
    if (!ok) throw new HttpError(401, "Invalid username or password.");

    const authUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    };
    res.json({
      token: signToken(authUser),
      user: authUser,
    });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json({ user: req.user });
  })
);

export default router;
