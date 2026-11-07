import { Router } from "express";
import { camels, query } from "../db";
import { asyncRoute } from "../lib/http";

const router = Router();

router.get(
  "/",
  asyncRoute(async (_req, res) => {
    const result = await query(
      `SELECT id, occurred_at, operator_name, action, document, details
       FROM audit_log ORDER BY occurred_at DESC, id DESC LIMIT 500`
    );
    res.json(camels(result.rows));
  })
);

export default router;
