import { Router } from "express";
import { z } from "zod";
import { camels, query, withTx } from "../db";
import { writeAudit } from "../lib/audit";
import { asyncRoute, HttpError, needConfirm, operatorName } from "../lib/http";
import { yen } from "../lib/money";
import { formatCode } from "../lib/numbering";

const router = Router();

const paymentSchema = z.object({
  invoiceNo: z.string().min(1),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().int().positive(),
  method: z.string().min(1),
  reference: z.string().default(""),
  remarks: z.string().default(""),
  confirmEarlyDate: z.boolean().optional(),
  confirmFutureDate: z.boolean().optional(),
  confirmDuplicate: z.boolean().optional(),
  confirmOverpayment: z.boolean().optional(),
});

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const invoiceNo = String(req.query.invoiceNo || "").trim();
    const result = await query(
      `SELECT p.*, i.invoice_no, r.payment_code AS reverses_code
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       LEFT JOIN payments r ON r.id = p.reverses_payment_id
       WHERE ($1 = '' OR i.invoice_no ILIKE $2)
       ORDER BY p.recorded_at DESC, p.id DESC`,
      [invoiceNo, `%${invoiceNo}%`]
    );
    res.json(camels(result.rows));
  })
);

router.post(
  "/",
  asyncRoute(async (req, res) => {
    const body = paymentSchema.parse(req.body);
    const created = await withTx(async (client) => {
      const invoiceResult = await client.query(
        "SELECT * FROM invoices WHERE invoice_no = $1 FOR UPDATE",
        [body.invoiceNo.trim()]
      );
      const invoice = invoiceResult.rows[0];
      if (!invoice) throw new HttpError(400, "That invoice is not in the register. Only finalized invoices can be paid.");
      const paid = await client.query(
        "SELECT COALESCE(SUM(amount), 0)::bigint AS received FROM payments WHERE invoice_id = $1",
        [invoice.id]
      );
      invoice.received = paid.rows[0].received;
      if (invoice.record_status === "Cancelled") {
        throw new HttpError(400, `Invoice ${invoice.invoice_no} is cancelled.`);
      }

      const methods = await client.query("SELECT 1 FROM payment_methods WHERE name = $1", [body.method.trim()]);
      if (!methods.rows[0]) throw new HttpError(400, "Choose a payment method from the list.");

      const invoiceDate = String(invoice.invoice_date).slice(0, 10);
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      if (body.paymentDate < invoiceDate && !body.confirmEarlyDate) {
        needConfirm(
          "confirmEarlyDate",
          `The payment is dated before the invoice (${invoiceDate}). The payment date is ${body.paymentDate}. Record it with this date anyway?`
        );
      }
      if (body.paymentDate > todayIso && !body.confirmFutureDate) {
        needConfirm("confirmFutureDate", `The payment date ${body.paymentDate} is in the future. Record it anyway?`);
      }

      const duplicate = await client.query(
        `SELECT payment_code FROM payments
         WHERE invoice_id = $1 AND payment_date = $2 AND amount = $3 AND reference = $4
           AND entry_type = 'Payment' AND status = 'Active'`,
        [invoice.id, body.paymentDate, body.amount, body.reference.trim()]
      );
      if (duplicate.rows[0] && !body.confirmDuplicate) {
        needConfirm(
          "confirmDuplicate",
          `A payment of ${yen(body.amount)} on ${body.paymentDate} with the same reference is already recorded (${duplicate.rows[0].payment_code}). Record this one as well?`
        );
      }

      const outstanding = Number(invoice.grand_total) - Number(invoice.received);
      if (body.amount > outstanding && !body.confirmOverpayment) {
        needConfirm(
          "confirmOverpayment",
          `This payment exceeds the outstanding balance.\nInvoice total: ${yen(Number(invoice.grand_total))}\nAlready received: ${yen(Number(invoice.received))}\nOutstanding: ${yen(outstanding)}\nThis payment: ${yen(body.amount)}\nExcess: ${yen(body.amount - outstanding)}\nRecord it anyway? It will be flagged as an overpayment.`
        );
      }

      const settings = await client.query("SELECT next_payment_no FROM settings WHERE id = 1 FOR UPDATE");
      const nextNo = Number(settings.rows[0].next_payment_no);
      const code = formatCode("PAY-", nextNo, 6);
      const inserted = await client.query(
        `INSERT INTO payments (
          payment_code, invoice_id, customer_name, payment_date, amount, method, reference, remarks,
          entry_type, status, flag
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Payment','Active',$9)
        RETURNING *`,
        [
          code,
          invoice.id,
          invoice.customer_name,
          body.paymentDate,
          body.amount,
          body.method.trim(),
          body.reference.trim(),
          body.remarks.trim(),
          body.amount > outstanding ? "Overpayment" : "",
        ]
      );
      await client.query("UPDATE settings SET next_payment_no = $1, updated_at = now() WHERE id = 1", [nextNo + 1]);
      await writeAudit(client, {
        operator: operatorName(req),
        action: "Record payment",
        document: invoice.invoice_no,
        details: `${code} / ${yen(body.amount)} / ${body.method.trim()}`,
      });
      return inserted.rows[0];
    });
    res.status(201).json(created);
  })
);

router.post(
  "/:id/reverse",
  asyncRoute(async (req, res) => {
    const body = z.object({ reason: z.string().min(1) }).parse(req.body);
    const reason = body.reason.trim();
    if (!reason) throw new HttpError(400, "A reason is required.");
    const created = await withTx(async (client) => {
      const original = await client.query(
        `SELECT p.*, i.invoice_no, i.record_status
         FROM payments p JOIN invoices i ON i.id = p.invoice_id
         WHERE p.id = $1 FOR UPDATE`,
        [req.params.id]
      );
      const payment = original.rows[0];
      if (!payment) throw new HttpError(404, "Payment not found.");
      if (payment.entry_type !== "Payment" && payment.entry_type !== "Transfer") {
        throw new HttpError(400, `${payment.payment_code} is a ${payment.entry_type} entry and cannot be reversed.`);
      }
      if (payment.status !== "Active") throw new HttpError(400, `${payment.payment_code} has already been reversed.`);
      if (payment.record_status === "Cancelled") {
        throw new HttpError(400, `Invoice ${payment.invoice_no} is cancelled.`);
      }
      const settings = await client.query("SELECT next_payment_no FROM settings WHERE id = 1 FOR UPDATE");
      const nextNo = Number(settings.rows[0].next_payment_no);
      const code = formatCode("PAY-", nextNo, 6);
      await client.query("UPDATE payments SET status = 'Reversed' WHERE id = $1", [payment.id]);
      const inserted = await client.query(
        `INSERT INTO payments (
          payment_code, invoice_id, customer_name, payment_date, amount, method, reference, remarks,
          entry_type, reverses_payment_id, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Reversal',$9,'Active')
        RETURNING *`,
        [
          code,
          payment.invoice_id,
          payment.customer_name,
          payment.payment_date,
          -Number(payment.amount),
          payment.method,
          payment.reference,
          reason,
          payment.id,
        ]
      );
      await client.query("UPDATE settings SET next_payment_no = $1, updated_at = now() WHERE id = 1", [nextNo + 1]);
      await writeAudit(client, {
        operator: operatorName(req),
        action: "Reverse payment",
        document: payment.invoice_no,
        details: `${payment.payment_code} reversed by ${code} / ${reason}`,
      });
      return inserted.rows[0];
    });
    res.status(201).json(created);
  })
);

export default router;
