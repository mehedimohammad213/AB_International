import { Router } from "express";
import type { PoolClient } from "pg";
import { camel, camels, query, withTx } from "../db";
import { writeAudit } from "../lib/audit";
import { addDays, documentSchema, prepareDocument, todayIso } from "../lib/documents";
import { asyncRoute, HttpError, operatorName } from "../lib/http";
import { yen } from "../lib/money";
import { formatCode, formatInvoiceNo } from "../lib/numbering";

const router = Router();

router.post(
  "/preview",
  asyncRoute(async (req, res) => {
    const prepared = prepareDocument(documentSchema.parse(req.body), false);
    res.json({
      subtotal: prepared.totals.subtotal,
      discount: prepared.totals.discount,
      tax: prepared.totals.tax,
      otherCharges: prepared.totals.otherCharges,
      grandTotal: prepared.totals.grandTotal,
      lines: prepared.lines,
    });
  })
);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const status = String(req.query.status || "Open");
    const result = await query(
      `SELECT d.*, c.name AS customer_name, c.customer_code, i.invoice_no AS replaces_no, f.invoice_no AS finalized_no
       FROM drafts d
       LEFT JOIN customers c ON c.id = d.customer_id
       LEFT JOIN invoices i ON i.id = d.replaces_invoice_id
       LEFT JOIN invoices f ON f.id = d.finalized_invoice_id
       WHERE ($1 = 'All' OR d.status = $1)
       ORDER BY d.saved_at DESC, d.id DESC`,
      [status]
    );
    res.json(camels(result.rows));
  })
);

router.get(
  "/:id",
  asyncRoute(async (req, res) => {
    res.json(await loadDraft(Number(req.params.id)));
  })
);

router.post(
  "/",
  asyncRoute(async (req, res) => {
    const prepared = prepareDocument(documentSchema.parse(req.body), false);
    const id = await withTx(async (client) => {
      const settings = await client.query("SELECT next_draft_no FROM settings WHERE id = 1 FOR UPDATE");
      const nextNo = Number(settings.rows[0].next_draft_no);
      const code = formatCode("DFT-", nextNo, 4);
      const inserted = await client.query(
        `INSERT INTO drafts (
          draft_code, invoice_date, due_date, customer_id, subject, terms, remarks,
          discount_rate, discount_fixed, tax_mode, tax_rate, tax_rounding,
          other_charges_label, other_charges, estimated_total
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING id`,
        draftValues(code, prepared)
      );
      await replaceDraftLines(client, inserted.rows[0].id, prepared.lines);
      await client.query("UPDATE settings SET next_draft_no = $1, updated_at = now() WHERE id = 1", [nextNo + 1]);
      await writeAudit(client, {
        operator: operatorName(req),
        action: "Save draft",
        document: code,
        details: `${yen(prepared.totals.grandTotal)} / ${prepared.lines.length} line(s)`,
      });
      return inserted.rows[0].id as number;
    });
    res.status(201).json(await loadDraft(id));
  })
);

router.put(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const prepared = prepareDocument(documentSchema.parse(req.body), false);
    await withTx(async (client) => {
      const existing = await client.query("SELECT * FROM drafts WHERE id = $1 FOR UPDATE", [id]);
      if (!existing.rows[0]) throw new HttpError(404, "Draft not found.");
      if (existing.rows[0].status !== "Open") throw new HttpError(400, "This draft is no longer open.");
      await client.query(
        `UPDATE drafts SET
          invoice_date = $2, due_date = $3, customer_id = $4, subject = $5, terms = $6, remarks = $7,
          discount_rate = $8, discount_fixed = $9, tax_mode = $10, tax_rate = $11, tax_rounding = $12,
          other_charges_label = $13, other_charges = $14, estimated_total = $15, saved_at = now()
         WHERE id = $1`,
        [
          id,
          prepared.input.invoiceDate || null,
          prepared.input.dueDate || null,
          prepared.input.customerId || null,
          prepared.input.subject.trim(),
          prepared.input.terms.trim(),
          prepared.input.remarks.trim(),
          prepared.totals.discountRate,
          prepared.input.discountFixed,
          prepared.input.taxMode,
          prepared.input.taxRate,
          prepared.input.taxRounding,
          prepared.input.otherChargesLabel.trim(),
          prepared.totals.otherCharges,
          prepared.totals.grandTotal,
        ]
      );
      await replaceDraftLines(client, id, prepared.lines);
      await writeAudit(client, {
        operator: operatorName(req),
        action: "Save draft",
        document: String(existing.rows[0].draft_code),
        details: `${yen(prepared.totals.grandTotal)} / ${prepared.lines.length} line(s)`,
      });
    });
    res.json(await loadDraft(id));
  })
);

router.post(
  "/:id/discard",
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    await withTx(async (client) => {
      const existing = await client.query("SELECT * FROM drafts WHERE id = $1 FOR UPDATE", [id]);
      if (!existing.rows[0]) throw new HttpError(404, "Draft not found.");
      if (existing.rows[0].status !== "Open") throw new HttpError(400, "Only an open draft can be discarded.");
      await client.query("UPDATE drafts SET status = 'Discarded', saved_at = now() WHERE id = $1", [id]);
      await writeAudit(client, {
        operator: operatorName(req),
        action: "Discard draft",
        document: String(existing.rows[0].draft_code),
        details: "Draft discarded. No invoice number was issued.",
      });
    });
    res.json(await loadDraft(id));
  })
);

router.post(
  "/:id/finalize",
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const created = await withTx(async (client) => finalizeDraft(client, id, operatorName(req)));
    res.status(201).json(created);
  })
);

function draftValues(
  code: string,
  prepared: ReturnType<typeof prepareDocument>
) {
  return [
    code,
    prepared.input.invoiceDate || null,
    prepared.input.dueDate || null,
    prepared.input.customerId || null,
    prepared.input.subject.trim(),
    prepared.input.terms.trim(),
    prepared.input.remarks.trim(),
    prepared.totals.discountRate,
    prepared.input.discountFixed,
    prepared.input.taxMode,
    prepared.input.taxRate,
    prepared.input.taxRounding,
    prepared.input.otherChargesLabel.trim(),
    prepared.totals.otherCharges,
    prepared.totals.grandTotal,
  ];
}

async function replaceDraftLines(
  client: PoolClient,
  draftId: number,
  lines: ReturnType<typeof prepareDocument>["lines"]
) {
  await client.query("DELETE FROM draft_lines WHERE draft_id = $1", [draftId]);
  for (const line of lines) {
    await client.query(
      `INSERT INTO draft_lines (draft_id, line_no, description, qty, unit, unit_price, line_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [draftId, line.lineNo, line.description, line.qty, line.unit, line.unitPrice, line.lineTotal]
    );
  }
}

export async function loadDraft(id: number) {
  const result = await query(
    `SELECT d.*, c.name AS customer_name, c.customer_code, i.invoice_no AS replaces_no
     FROM drafts d
     LEFT JOIN customers c ON c.id = d.customer_id
     LEFT JOIN invoices i ON i.id = d.replaces_invoice_id
     WHERE d.id = $1`,
    [id]
  );
  if (!result.rows[0]) throw new HttpError(404, "Draft not found.");
  const lines = await query(
    `SELECT line_no, description, qty, unit, unit_price, line_total
     FROM draft_lines WHERE draft_id = $1 ORDER BY line_no`,
    [id]
  );
  return { ...camel<Record<string, unknown>>(result.rows[0]), lines: camels(lines.rows) };
}

async function finalizeDraft(client: PoolClient, draftId: number, operator: string) {
  const draftResult = await client.query("SELECT * FROM drafts WHERE id = $1 FOR UPDATE", [draftId]);
  const draft = draftResult.rows[0];
  if (!draft) throw new HttpError(404, "Draft not found.");
  if (draft.status !== "Open") throw new HttpError(400, "This draft is already finalized or discarded.");

  const lineResult = await client.query(
    "SELECT * FROM draft_lines WHERE draft_id = $1 ORDER BY line_no",
    [draftId]
  );

  const settingsResult = await client.query("SELECT * FROM settings WHERE id = 1 FOR UPDATE");
  const settings = settingsResult.rows[0];
  const customer = draft.customer_id
    ? (await client.query("SELECT * FROM customers WHERE id = $1", [draft.customer_id])).rows[0]
    : null;
  if (draft.customer_id && !customer) throw new HttpError(400, "The selected customer no longer exists.");

  const invoiceDate = draft.invoice_date ? String(draft.invoice_date).slice(0, 10) : todayIso();
  const year = Number(invoiceDate.slice(0, 4));
  let sequence = Number(settings.next_sequence);
  if (settings.restart_each_year && Number(settings.sequence_year) !== year) sequence = 1;
  const invoiceNo = formatInvoiceNo(
    {
      invoicePrefix: settings.invoice_prefix,
      separator: settings.separator,
      yearFormat: settings.year_format,
      sequenceDigits: Number(settings.sequence_digits),
    },
    year,
    sequence
  );

  const dueDate = draft.due_date
    ? String(draft.due_date).slice(0, 10)
    : addDays(invoiceDate, Number(settings.default_due_days));

  const prepared = prepareDocument(
    {
      invoiceDate,
      dueDate,
      customerId: customer?.id ?? null,
      subject: draft.subject,
      terms: draft.terms,
      remarks: draft.remarks,
      discountPercent: Number(draft.discount_rate) * 100,
      discountFixed: Number(draft.discount_fixed),
      taxMode: draft.tax_mode,
      taxRate: Number(draft.tax_rate),
      taxRounding: draft.tax_rounding,
      otherChargesLabel: draft.other_charges_label,
      otherCharges: Number(draft.other_charges),
      lines: lineResult.rows.map((line) => ({
        description: line.description,
        qty: Number(line.qty),
        unit: line.unit,
        unitPrice: Number(line.unit_price),
      })),
    },
    false
  );

  let replacesId: number | null = draft.replaces_invoice_id;
  if (replacesId) {
    const old = await client.query("SELECT * FROM invoices WHERE id = $1 FOR UPDATE", [replacesId]);
    if (!old.rows[0]) throw new HttpError(400, "The invoice being replaced was not found.");
    if (old.rows[0].record_status !== "Issued") {
      throw new HttpError(400, "Only an issued invoice can be corrected and reissued.");
    }
  }

  const serialResult = await client.query("SELECT COALESCE(MAX(serial_no), 0) + 1 AS serial FROM invoices");
  const inserted = await client.query(
    `INSERT INTO invoices (
      serial_no, invoice_no, invoice_date, due_date, customer_id, customer_name, customer_phone,
      company_name, postal_code, address, email, customer_reg_no, subject, terms, remarks,
      subtotal, discount, tax, other_charges, grand_total, discount_rate, discount_fixed,
      tax_mode, tax_rate, tax_rounding, tax_label, other_charges_label, line_count,
      replaces_invoice_id, source_draft_id
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30
    ) RETURNING id`,
    [
      serialResult.rows[0].serial,
      invoiceNo,
      invoiceDate,
      dueDate,
      customer?.id ?? null,
      customer?.name ?? "",
      customer?.phone ?? "",
      customer?.company_name ?? "",
      customer?.postal_code ?? "",
      customer?.address ?? "",
      customer?.email ?? "",
      customer?.tax_reg_no ?? "",
      draft.subject,
      draft.terms,
      draft.remarks,
      prepared.totals.subtotal,
      prepared.totals.discount,
      prepared.totals.tax,
      prepared.totals.otherCharges,
      prepared.totals.grandTotal,
      draft.discount_rate,
      draft.discount_fixed,
      draft.tax_mode,
      draft.tax_rate,
      draft.tax_rounding,
      settings.tax_label,
      draft.other_charges_label,
      prepared.lines.length,
      replacesId,
      draftId,
    ]
  );

  const invoiceId = inserted.rows[0].id as number;
  for (const line of prepared.lines) {
    await client.query(
      `INSERT INTO invoice_lines (invoice_id, line_no, description, qty, unit, unit_price, line_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invoiceId, line.lineNo, line.description, line.qty, line.unit, line.unitPrice, line.lineTotal]
    );
  }

  let nextPaymentNo = Number(settings.next_payment_no);
  if (replacesId) {
    const old = await client.query("SELECT invoice_no FROM invoices WHERE id = $1", [replacesId]);
    const oldNo = String(old.rows[0].invoice_no);
    nextPaymentNo = await movePayments(
      client,
      replacesId,
      invoiceId,
      oldNo,
      invoiceNo,
      customer?.name ?? "",
      nextPaymentNo,
      operator
    );
    await client.query(
      `UPDATE invoices
       SET record_status = 'Cancelled', cancelled_at = now(), cancel_reason = $2, replaced_by_invoice_id = $3
       WHERE id = $1`,
      [replacesId, `Replaced by ${invoiceNo}`, invoiceId]
    );
    await writeAudit(client, {
      operator,
      action: "Cancel (replaced)",
      document: oldNo,
      details: `Replaced by ${invoiceNo}`,
    });
  }

  await client.query(
    `UPDATE drafts SET status = 'Finalized', finalized_invoice_id = $2, estimated_total = $3, saved_at = now() WHERE id = $1`,
    [draftId, invoiceId, prepared.totals.grandTotal]
  );
  await client.query(
    `UPDATE settings SET
      next_sequence = $1, sequence_year = $2, last_invoice_no = $3, next_payment_no = $4, updated_at = now()
     WHERE id = 1`,
    [sequence + 1, year, invoiceNo, nextPaymentNo]
  );
  await writeAudit(client, {
    operator,
    action: "Finalize invoice",
    document: invoiceNo,
    details: `${customer?.name || "No customer"} / ${yen(prepared.totals.grandTotal)} / ${prepared.lines.length} line(s)`,
  });
  return { id: invoiceId, invoiceNo };
}

async function movePayments(
  client: PoolClient,
  oldId: number,
  newId: number,
  oldNo: string,
  newNo: string,
  customerName: string,
  nextPaymentNo: number,
  operator: string
) {
  const payments = await client.query(
    `SELECT * FROM payments
     WHERE invoice_id = $1 AND status = 'Active' AND amount > 0 AND entry_type IN ('Payment', 'Transfer')
     ORDER BY id
     FOR UPDATE`,
    [oldId]
  );
  let moved = 0;
  for (const payment of payments.rows) {
    await client.query("UPDATE payments SET status = 'Reversed' WHERE id = $1", [payment.id]);
    const reversalCode = formatCode("PAY-", nextPaymentNo, 6);
    nextPaymentNo += 1;
    await client.query(
      `INSERT INTO payments (
        payment_code, invoice_id, customer_name, payment_date, amount, method, reference, remarks,
        entry_type, reverses_payment_id, status, flag
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Reversal',$9,'Active','Transfer out')`,
      [
        reversalCode,
        oldId,
        payment.customer_name,
        payment.payment_date,
        -Number(payment.amount),
        payment.method,
        payment.reference,
        `Transferred to ${newNo}`,
        payment.id,
      ]
    );
    const transferCode = formatCode("PAY-", nextPaymentNo, 6);
    nextPaymentNo += 1;
    await client.query(
      `INSERT INTO payments (
        payment_code, invoice_id, customer_name, payment_date, amount, method, reference, remarks,
        entry_type, status, flag
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Transfer','Active','Transfer in')`,
      [
        transferCode,
        newId,
        customerName,
        payment.payment_date,
        payment.amount,
        payment.method,
        payment.reference,
        `Transferred from ${oldNo}`,
      ]
    );
    moved += Number(payment.amount);
  }
  if (moved !== 0) {
    await writeAudit(client, {
      operator,
      action: "Transfer payments",
      document: newNo,
      details: `${yen(moved)} moved from ${oldNo}`,
    });
  }
  return nextPaymentNo;
}

export default router;
