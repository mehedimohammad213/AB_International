import type { Pool, PoolClient } from "pg";

type Db = Pool | PoolClient;

export async function writeAudit(
  db: Db,
  entry: { operator: string; action: string; document?: string; details?: string }
) {
  await db.query(
    `INSERT INTO audit_log (operator_name, action, document, details)
     VALUES ($1, $2, $3, $4)`,
    [entry.operator, entry.action, entry.document ?? "", entry.details ?? ""]
  );
}
