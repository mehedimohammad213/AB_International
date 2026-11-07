import cors from "cors";
import express from "express";
import { requireAuth } from "./lib/auth";
import { errorMiddleware } from "./lib/http";
import auditRoutes from "./routes/audit";
import authRoutes from "./routes/auth";
import customerRoutes from "./routes/customers";
import dashboardRoutes from "./routes/dashboard";
import draftRoutes from "./routes/drafts";
import invoiceRoutes from "./routes/invoices";
import paymentRoutes from "./routes/payments";
import settingsRoutes from "./routes/settings";

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
  app.use(express.json({ limit: "1mb" }));
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "AB International Invoice API" });
  });
  app.use("/api/auth", authRoutes);
  app.use("/api", requireAuth);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/customers", customerRoutes);
  app.use("/api/drafts", draftRoutes);
  app.use("/api/invoices", invoiceRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/audit", auditRoutes);
  app.use(errorMiddleware);
  return app;
}
