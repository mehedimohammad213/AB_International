import fs from "fs";
import path from "path";
import { getPool } from "./db";

export async function migrate() {
  const file = path.join(__dirname, "..", "db", "schema.sql");
  const sql = fs.readFileSync(file, "utf8");
  await getPool().query(sql);
}
