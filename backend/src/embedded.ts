import fs from "fs";
import path from "path";
import EmbeddedPostgres from "embedded-postgres";

let server: EmbeddedPostgres | null = null;

export async function ensureDatabase() {
  if (process.env.EMBEDDED_POSTGRES === "false") return;
  if (server) return;

  const port = Number(process.env.EMBEDDED_PORT || 54329);
  const databaseDir = path.join(__dirname, "..", ".pgdata");
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  if (!fs.existsSync(path.join(databaseDir, "PG_VERSION"))) {
    await postgres.initialise();
  }
  await postgres.start();
  try {
    await postgres.createDatabase("ab_invoice");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) throw error;
  }

  process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${port}/ab_invoice`;
  server = postgres;
}

export async function stopDatabase() {
  if (!server) return;
  await server.stop();
  server = null;
}
