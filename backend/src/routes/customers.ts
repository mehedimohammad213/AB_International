import { Router } from "express";
import { z } from "zod";
import { camel, camels, query, withTx } from "../db";
import { writeAudit } from "../lib/audit";
import { asyncRoute, HttpError, needConfirm, operatorName } from "../lib/http";
import { formatCode } from "../lib/numbering";

const router = Router();

const customerSchema = z.object({
  name: z.string().min(1),
  companyName: z.string().default(""),
  postalCode: z.string().default(""),
  address: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  taxRegNo: z.string().default(""),
  remarks: z.string().default(""),
  confirmDuplicate: z.boolean().optional(),
});

const listSql = `
  SELECT c.*,
    EXISTS (
      SELECT 1 FROM customers o
      WHERE o.id <> c.id
        AND lower(btrim(o.name)) = lower(btrim(c.name))
        AND btrim(coalesce(c.phone, '')) <> ''
        AND lower(btrim(o.phone)) = lower(btrim(c.phone))
    ) AS duplicate_name_phone,
    EXISTS (
      SELECT 1 FROM customers o
      WHERE o.id <> c.id AND lower(btrim(o.name)) = lower(btrim(c.name))
    ) AS duplicate_name
  FROM customers c
`;

function buildListFilters(reqQuery: Record<string, unknown>) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const search = String(reqQuery.q || "").trim();
  const filter = String(reqQuery.filter || "all");
  const from = String(reqQuery.from || "").trim();
  const to = String(reqQuery.to || "").trim();

  if (search) {
    params.push(`%${search}%`);
    const i = params.length;
    clauses.push(`(
      c.customer_code ILIKE $${i}
      OR c.name ILIKE $${i}
      OR c.company_name ILIKE $${i}
      OR c.phone ILIKE $${i}
      OR c.email ILIKE $${i}
      OR c.postal_code ILIKE $${i}
      OR c.address ILIKE $${i}
      OR c.tax_reg_no ILIKE $${i}
    )`);
  }

  if (from) {
    params.push(from);
    clauses.push(`c.created_at::date >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    clauses.push(`c.created_at::date <= $${params.length}::date`);
  }

  if (filter === "duplicates") {
    clauses.push(`EXISTS (
      SELECT 1 FROM customers o
      WHERE o.id <> c.id AND lower(btrim(o.name)) = lower(btrim(c.name))
    )`);
  } else if (filter === "missing_email") {
    clauses.push(`btrim(coalesce(c.email, '')) = ''`);
  } else if (filter === "missing_phone") {
    clauses.push(`btrim(coalesce(c.phone, '')) = ''`);
  } else if (filter === "has_company") {
    clauses.push(`btrim(coalesce(c.company_name, '')) <> ''`);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
    search,
    filter,
  };
}

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const { where, params } = buildListFilters(req.query as Record<string, unknown>);
    const paginate = req.query.page != null;
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);

    if (!paginate) {
      const result = await query(`${listSql} ${where} ORDER BY c.customer_code`, params);
      res.json(camels(result.rows));
      return;
    }

    const countResult = await query(`SELECT COUNT(*)::int AS total FROM customers c ${where}`, params);
    const total = Number(countResult.rows[0]?.total || 0);
    const offset = (page - 1) * pageSize;
    const result = await query(
      `${listSql} ${where} ORDER BY c.customer_code LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );
    res.json({
      items: camels(result.rows),
      total,
      page,
      pageSize,
    });
  })
);

router.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const result = await query(`${listSql} WHERE c.id = $1`, [req.params.id]);
    if (!result.rows[0]) throw new HttpError(404, "Customer not found.");
    res.json(camel(result.rows[0]));
  })
);

async function assertDuplicate(body: z.infer<typeof customerSchema>, ignoreId?: number) {
  const sameName = await query(
    `SELECT customer_code, name, phone FROM customers
     WHERE lower(btrim(name)) = lower(btrim($1)) AND ($2::int IS NULL OR id <> $2)`,
    [body.name.trim(), ignoreId ?? null]
  );
  const phone = body.phone.trim().toLowerCase();
  const sameBoth = sameName.rows.filter(
    (row) => phone !== "" && String(row.phone || "").trim().toLowerCase() === phone
  );
  if (!body.confirmDuplicate && sameName.rows.length > 0) {
    const listed = sameName.rows
      .map((row) => `${row.customer_code} ${row.name}`)
      .join(", ");
    const extra = sameBoth.length
      ? " The name and phone match an existing customer."
      : "";
    needConfirm(
      "confirmDuplicate",
      `A customer with the same name already exists: ${listed}.${extra} Add a separate customer anyway?`
    );
  }
}

router.post(
  "/",
  asyncRoute(async (req, res) => {
    const body = customerSchema.parse(req.body);
    await assertDuplicate(body);
    const created = await withTx(async (client) => {
      const settings = await client.query("SELECT next_customer_no FROM settings WHERE id = 1 FOR UPDATE");
      const nextNo = Number(settings.rows[0].next_customer_no);
      const code = formatCode("CUST-", nextNo, 4);
      const inserted = await client.query(
        `INSERT INTO customers
          (customer_code, name, company_name, postal_code, address, phone, email, tax_reg_no, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          code,
          body.name.trim(),
          body.companyName.trim(),
          body.postalCode.trim(),
          body.address.trim(),
          body.phone.trim(),
          body.email.trim(),
          body.taxRegNo.trim(),
          body.remarks.trim(),
        ]
      );
      await client.query("UPDATE settings SET next_customer_no = $1, updated_at = now() WHERE id = 1", [nextNo + 1]);
      await writeAudit(client, {
        operator: operatorName(req),
        action: "Add customer",
        document: code,
        details: body.name.trim(),
      });
      return inserted.rows[0];
    });
    res.status(201).json(camel(created));
  })
);

router.put(
  "/:id",
  asyncRoute(async (req, res) => {
    const body = customerSchema.parse(req.body);
    const id = Number(req.params.id);
    const existing = await query("SELECT * FROM customers WHERE id = $1", [id]);
    if (!existing.rows[0]) throw new HttpError(404, "Customer not found.");
    await assertDuplicate(body, id);
    const updated = await withTx(async (client) => {
      const result = await client.query(
        `UPDATE customers SET
          name = $2, company_name = $3, postal_code = $4, address = $5, phone = $6,
          email = $7, tax_reg_no = $8, remarks = $9, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [
          id,
          body.name.trim(),
          body.companyName.trim(),
          body.postalCode.trim(),
          body.address.trim(),
          body.phone.trim(),
          body.email.trim(),
          body.taxRegNo.trim(),
          body.remarks.trim(),
        ]
      );
      await writeAudit(client, {
        operator: operatorName(req),
        action: "Save customer changes",
        document: String(existing.rows[0].customer_code),
        details: body.name.trim(),
      });
      return result.rows[0];
    });
    res.json(camel(updated));
  })
);

router.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await query("SELECT * FROM customers WHERE id = $1", [id]);
    if (!existing.rows[0]) throw new HttpError(404, "Customer not found.");

    const linked = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM invoices WHERE customer_id = $1) AS invoices,
         (SELECT COUNT(*)::int FROM drafts WHERE customer_id = $1) AS drafts`,
      [id]
    );
    const invoiceCount = Number(linked.rows[0].invoices);
    const draftCount = Number(linked.rows[0].drafts);
    if (invoiceCount > 0 || draftCount > 0) {
      throw new HttpError(
        400,
        `Cannot delete ${existing.rows[0].customer_code}: linked to ${invoiceCount} invoice(s) and ${draftCount} draft(s).`
      );
    }

    await withTx(async (client) => {
      await client.query("DELETE FROM customers WHERE id = $1", [id]);
      await writeAudit(client, {
        operator: operatorName(req),
        action: "Delete customer",
        document: String(existing.rows[0].customer_code),
        details: String(existing.rows[0].name),
      });
    });
    res.json({ ok: true });
  })
);

export default router;
