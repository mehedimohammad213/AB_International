import { Router } from "express";
import { z } from "zod";
import { camel, camels, getPool, query, withTx } from "../db";
import { writeAudit } from "../lib/audit";
import { documentSchema, prepareDocument } from "../lib/documents";
import { asyncRoute, HttpError, operatorName } from "../lib/http";
import { formatCode } from "../lib/numbering";
import { INVOICE_COLUMNS } from "../sql";

const router = Router();

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const search = String(req.query.q || "").trim();
    const status = String(req.query.status || "All");
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    const paginate = req.query.page != null;
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);

    if (search) {
      params.push(`%${search}%`);
      clauses.push(`(invoice_no ILIKE $${params.length} OR customer_name ILIKE $${params.length})`);
    }
    if (from) {
      params.push(from);
      clauses.push(`invoice_date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      clauses.push(`invoice_date <= $${params.length}`);
    }
    if (status === "Cancelled") clauses.push(`record_status = 'Cancelled'`);
    else if (status === "Overdue") clauses.push(`overdue = 'Overdue'`);
    else if (status !== "All") {
      clauses.push(`record_status = 'Issued'`);
      params.push(status);
      clauses.push(`payment_status = $${params.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const listed = `SELECT * FROM (${INVOICE_COLUMNS}) AS listed`;

    if (!paginate) {
      const result = await query(`${listed} ${where} ORDER BY serial_no DESC`, params);
      res.json(camels(result.rows));
      return;
    }

    const countResult = await query(`SELECT COUNT(*)::int AS total FROM (${INVOICE_COLUMNS}) AS listed ${where}`, params);
    const total = Number(countResult.rows[0]?.total || 0);
    const offset = (page - 1) * pageSize;
    const result = await query(
      `${listed} ${where} ORDER BY serial_no DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
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
    res.json(await loadInvoice(req.params.id));
  })
);

router.post(
  "/:id/cancel",
  asyncRoute(async (req, res) => {
    const body = z.object({ reason: z.string().min(1) }).parse(req.body);
    const reason = body.reason.trim();
    if (!reason) throw new HttpError(400, "A reason is required.");
    await withTx(async (client) => {
      const invoice = await lockInvoice(client, req.params.id);
      if (invoice.record_status === "Cancelled") throw new HttpError(400, "This invoice is already cancelled.");
      const paid = await client.query(
        "SELECT COALESCE(SUM(amount), 0)::bigint AS received FROM payments WHERE invoice_id = $1",
        [invoice.id]
      );
      const received = Number(paid.rows[0].received);
      if (received !== 0) {
        throw new HttpError(
          400,
          `Invoice ${invoice.invoice_no} has payments recorded against it. Reverse those payments first, or use Correct / Reissue to move them.`
        );
      }
      await client.query(
        `UPDATE invoices
         SET record_status = 'Cancelled', cancelled_at = now(), cancel_reason = $2
         WHERE id = $1`,
        [invoice.id, reason]
      );
      await writeAudit(client, {
        operator: operatorName(req),
        action: "Cancel invoice",
        document: invoice.invoice_no,
        details: reason,
      });
    });
    res.json(await loadInvoice(req.params.id));
  })
);

router.post(
  "/:id/reissue",
  asyncRoute(async (req, res) => {
    const draftId = await withTx(async (client) => {
      const invoice = await lockInvoice(client, req.params.id);
      if (invoice.record_status !== "Issued") {
        throw new HttpError(400, "Only an issued invoice can be corrected and reissued.");
      }
      const settings = await client.query("SELECT * FROM settings WHERE id = 1 FOR UPDATE");
      const nextNo = Number(settings.rows[0].next_draft_no);
      const code = formatCode("DFT-", nextNo, 4);
      const lines = await client.query(
        "SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY line_no",
        [invoice.id]
      );
      const inserted = await client.query(
        `INSERT INTO drafts (
          draft_code, invoice_date, due_date, customer_id, subject, terms, remarks,
          discount_rate, discount_fixed, tax_mode, tax_rate, tax_rounding,
          other_charges_label, other_charges, replaces_invoice_id, estimated_total
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING id`,
        [
          code,
          invoice.invoice_date,
          invoice.due_date,
          invoice.customer_id,
          invoice.subject,
          invoice.terms,
          invoice.remarks,
          invoice.discount_rate,
          invoice.discount_fixed,
          invoice.tax_mode,
          invoice.tax_rate,
          invoice.tax_rounding,
          invoice.other_charges_label,
          invoice.other_charges,
          invoice.id,
          invoice.grand_total,
        ]
      );
      for (const line of lines.rows) {
        await client.query(
          `INSERT INTO draft_lines (draft_id, line_no, description, qty, unit, unit_price, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [inserted.rows[0].id, line.line_no, line.description, line.qty, line.unit, line.unit_price, line.line_total]
        );
      }
      await client.query("UPDATE settings SET next_draft_no = $1, updated_at = now() WHERE id = 1", [nextNo + 1]);
      await writeAudit(client, {
        operator: operatorName(req),
        action: "Correct / reissue",
        document: code,
        details: `Copied from ${invoice.invoice_no}`,
      });
      return inserted.rows[0].id as number;
    });
    res.status(201).json({ id: draftId });
  })
);

router.post(
  "/:id/print-log",
  asyncRoute(async (req, res) => {
    const invoice = await loadInvoice(req.params.id);
    await writeAudit(getPool(), {
      operator: operatorName(req),
      action: "Print invoice",
      document: String(invoice.invoiceNo),
      details: "Opened the printable invoice",
    });
    res.json({ ok: true });
  })
);

router.put(
  "/:id",
  asyncRoute(async (req, res) => {
    const body = documentSchema.parse(req.body);
    const prepared = prepareDocument(body, true);
    await withTx(async (client) => {
      const invoice = await lockInvoice(client, req.params.id);
      if (invoice.record_status !== "Issued") {
        throw new HttpError(400, "Only an issued invoice can be edited.");
      }
      const customerResult = await client.query("SELECT * FROM customers WHERE id = $1", [prepared.input.customerId]);
      const customer = customerResult.rows[0];
      if (!customer) throw new HttpError(400, "The selected customer no longer exists.");
      const settings = await client.query("SELECT tax_label FROM settings WHERE id = 1");
      await client.query(
        `UPDATE invoices SET
          invoice_date = $2, due_date = $3, customer_id = $4, customer_name = $5, customer_phone = $6,
          company_name = $7, postal_code = $8, address = $9, email = $10, customer_reg_no = $11,
          subject = $12, terms = $13, remarks = $14,
          subtotal = $15, discount = $16, tax = $17, other_charges = $18, grand_total = $19,
          discount_rate = $20, discount_fixed = $21, tax_mode = $22, tax_rate = $23, tax_rounding = $24,
          tax_label = $25, other_charges_label = $26, line_count = $27
         WHERE id = $1`,
        [
          invoice.id,
          prepared.input.invoiceDate,
          prepared.input.dueDate || null,
          customer.id,
          customer.name,
          customer.phone,
          customer.company_name,
          customer.postal_code,
          customer.address,
          customer.email,
          customer.tax_reg_no,
          prepared.input.subject.trim(),
          prepared.input.terms.trim(),
          prepared.input.remarks.trim(),
          prepared.totals.subtotal,
          prepared.totals.discount,
          prepared.totals.tax,
          prepared.totals.otherCharges,
          prepared.totals.grandTotal,
          prepared.input.discountPercent / 100,
          prepared.input.discountFixed,
          prepared.input.taxMode,
          prepared.input.taxRate,
          prepared.input.taxRounding,
          settings.rows[0].tax_label,
          prepared.input.otherChargesLabel.trim(),
          prepared.lines.length,
        ]
      );
      await client.query("DELETE FROM invoice_lines WHERE invoice_id = $1", [invoice.id]);
      for (const line of prepared.lines) {
        await client.query(
          `INSERT INTO invoice_lines (invoice_id, line_no, description, qty, unit, unit_price, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [invoice.id, line.lineNo, line.description, line.qty, line.unit, line.unitPrice, line.lineTotal]
        );
      }
      await writeAudit(client, {
        operator: operatorName(req),
        action: "Edit invoice",
        document: invoice.invoice_no,
        details: `${customer.name} / ${prepared.totals.grandTotal}`,
      });
    });
    res.json(await loadInvoice(req.params.id));
  })
);

router.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    await withTx(async (client) => {
      const invoice = await lockInvoice(client, req.params.id);
      const paid = await client.query(
        "SELECT COALESCE(SUM(amount), 0)::bigint AS received, COUNT(*)::int AS entries FROM payments WHERE invoice_id = $1",
        [invoice.id]
      );
      if (Number(paid.rows[0].received) !== 0 || Number(paid.rows[0].entries) > 0) {
        throw new HttpError(
          400,
          `Invoice ${invoice.invoice_no} has payment records. Reverse or remove those payments before deleting.`
        );
      }
      await client.query("UPDATE drafts SET replaces_invoice_id = NULL WHERE replaces_invoice_id = $1", [invoice.id]);
      await client.query("UPDATE drafts SET finalized_invoice_id = NULL WHERE finalized_invoice_id = $1", [invoice.id]);
      await client.query("UPDATE invoices SET replaces_invoice_id = NULL WHERE replaces_invoice_id = $1", [invoice.id]);
      await client.query("UPDATE invoices SET replaced_by_invoice_id = NULL WHERE replaced_by_invoice_id = $1", [invoice.id]);
      await client.query("DELETE FROM invoices WHERE id = $1", [invoice.id]);
      await writeAudit(client, {
        operator: operatorName(req),
        action: "Delete invoice",
        document: invoice.invoice_no,
        details: invoice.customer_name,
      });
    });
    res.json({ ok: true });
  })
);

async function lockInvoice(client: { query: typeof import("pg").Pool.prototype.query }, key: string) {
  const result = await client.query(
    `SELECT * FROM invoices WHERE id::text = $1 OR invoice_no = $1 FOR UPDATE`,
    [key]
  );
  if (!result.rows[0]) throw new HttpError(404, "Invoice not found.");
  return result.rows[0];
}

export async function loadInvoice(key: string): Promise<{ id: number; invoiceNo: string } & Record<string, unknown>> {
  const result = await query(`${INVOICE_COLUMNS} WHERE i.id::text = $1 OR i.invoice_no = $1`, [key]);
  if (!result.rows[0]) throw new HttpError(404, "Invoice not found.");
  const invoice = result.rows[0];
  const lines = await query(
    `SELECT line_no, description, qty, unit, unit_price, line_total
     FROM invoice_lines WHERE invoice_id = $1 ORDER BY line_no`,
    [invoice.id]
  );
  const payments = await query(
    `SELECT p.*, r.payment_code AS reverses_code
     FROM payments p
     LEFT JOIN payments r ON r.id = p.reverses_payment_id
     WHERE p.invoice_id = $1
     ORDER BY p.recorded_at, p.id`,
    [invoice.id]
  );
  return {
    ...camel<Record<string, unknown>>(invoice),
    id: Number(invoice.id),
    invoiceNo: String(invoice.invoice_no),
    lines: camels(lines.rows),
    payments: camels(payments.rows),
  };
}

export default router;
