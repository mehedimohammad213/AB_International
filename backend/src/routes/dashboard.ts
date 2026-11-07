import { Router } from "express";
import { query } from "../db";
import { asyncRoute } from "../lib/http";

const router = Router();

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const summary = await query(
      `WITH reg AS (
         SELECT i.id, i.invoice_date, i.due_date, i.grand_total, i.record_status,
           COALESCE(pay.received, 0) AS received
         FROM invoices i
         LEFT JOIN (
           SELECT invoice_id, SUM(amount)::bigint AS received FROM payments GROUP BY invoice_id
         ) pay ON pay.invoice_id = i.id
       )
       SELECT
         COUNT(*) FILTER (WHERE record_status = 'Issued')::int AS finalized_invoices,
         COALESCE(SUM(grand_total) FILTER (WHERE record_status = 'Issued'), 0)::bigint AS total_invoiced,
         COALESCE(SUM(received) FILTER (WHERE record_status = 'Issued'), 0)::bigint AS payments_received,
         COALESCE(SUM(grand_total - received) FILTER (WHERE record_status = 'Issued'), 0)::bigint AS outstanding,
         COUNT(*) FILTER (WHERE record_status = 'Issued' AND received = 0 AND grand_total > 0)::int AS unpaid,
         COUNT(*) FILTER (WHERE record_status = 'Issued' AND received > 0 AND received < grand_total)::int AS partially_paid,
         COUNT(*) FILTER (WHERE record_status = 'Issued' AND received >= grand_total)::int AS fully_paid,
         COUNT(*) FILTER (
           WHERE record_status = 'Issued' AND grand_total - received > 0 AND due_date IS NOT NULL AND due_date < CURRENT_DATE
         )::int AS overdue_invoices,
         COALESCE(SUM(grand_total - received) FILTER (
           WHERE record_status = 'Issued' AND grand_total - received > 0 AND due_date IS NOT NULL AND due_date < CURRENT_DATE
         ), 0)::bigint AS overdue_receivables,
         COUNT(*) FILTER (WHERE record_status = 'Cancelled')::int AS cancelled
       FROM reg`
    );

    const months = await query(
      `WITH months AS (
         SELECT generate_series(1, 12) AS month
       )
       SELECT
         months.month,
         COUNT(i.id) FILTER (WHERE i.record_status = 'Issued')::int AS invoices_issued,
         COALESCE(SUM(i.grand_total) FILTER (WHERE i.record_status = 'Issued'), 0)::bigint AS invoice_value,
         COALESCE((
           SELECT SUM(p.amount) FROM payments p
           WHERE p.payment_date >= make_date($1, months.month, 1)
             AND p.payment_date < (make_date($1, months.month, 1) + interval '1 month')::date
         ), 0)::bigint AS payments_received,
         COALESCE(SUM(
           CASE WHEN i.record_status = 'Issued'
             THEN i.grand_total - COALESCE(pay.received, 0) ELSE 0 END
         ), 0)::bigint AS outstanding
       FROM months
       LEFT JOIN invoices i
         ON i.invoice_date >= make_date($1, months.month, 1)
        AND i.invoice_date < (make_date($1, months.month, 1) + interval '1 month')::date
       LEFT JOIN (
         SELECT invoice_id, SUM(amount)::bigint AS received FROM payments GROUP BY invoice_id
       ) pay ON pay.invoice_id = i.id
       GROUP BY months.month
       ORDER BY months.month`,
      [year]
    );

    const allPayments = await query("SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM payments");
    const yearPayments = months.rows.reduce((sum, row) => sum + Number(row.payments_received), 0);
    const row = summary.rows[0];
    res.json({
      year,
      finalizedInvoices: Number(row.finalized_invoices),
      totalInvoiced: Number(row.total_invoiced),
      paymentsReceived: Number(row.payments_received),
      outstanding: Number(row.outstanding),
      unpaid: Number(row.unpaid),
      partiallyPaid: Number(row.partially_paid),
      fullyPaid: Number(row.fully_paid),
      overdueInvoices: Number(row.overdue_invoices),
      overdueReceivables: Number(row.overdue_receivables),
      cancelled: Number(row.cancelled),
      paymentsOutsideYear: Number(allPayments.rows[0].total) - yearPayments,
      months: months.rows.map((month) => ({
        month: Number(month.month),
        invoicesIssued: Number(month.invoices_issued),
        invoiceValue: Number(month.invoice_value),
        paymentsReceived: Number(month.payments_received),
        outstanding: Number(month.outstanding),
      })),
    });
  })
);

export default router;
