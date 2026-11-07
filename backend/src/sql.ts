export const INVOICE_FROM = `
  FROM invoices i
  LEFT JOIN customers c ON c.id = i.customer_id
  LEFT JOIN invoices replaced ON replaced.id = i.replaced_by_invoice_id
  LEFT JOIN invoices replaces ON replaces.id = i.replaces_invoice_id
  LEFT JOIN (
    SELECT invoice_id,
           SUM(amount)::bigint AS received,
           MAX(payment_date) FILTER (WHERE amount > 0 AND status <> 'Reversed') AS last_payment_date
    FROM payments
    GROUP BY invoice_id
  ) pay ON pay.invoice_id = i.id
`;

export const INVOICE_COLUMNS = `
  SELECT
    i.*,
    c.customer_code,
    COALESCE(pay.received, 0)::bigint AS received,
    CASE
      WHEN i.record_status = 'Cancelled' THEN 0
      ELSE (i.grand_total - COALESCE(pay.received, 0))
    END::bigint AS outstanding,
    CASE
      WHEN i.record_status = 'Cancelled' THEN 'Cancelled'
      WHEN COALESCE(pay.received, 0) > i.grand_total THEN 'Overpaid'
      WHEN COALESCE(pay.received, 0) >= i.grand_total THEN 'Paid'
      WHEN COALESCE(pay.received, 0) > 0 THEN 'Partially Paid'
      ELSE 'Unpaid'
    END AS payment_status,
    pay.last_payment_date,
    CASE
      WHEN i.record_status <> 'Cancelled'
        AND (i.grand_total - COALESCE(pay.received, 0)) > 0
        AND i.due_date IS NOT NULL
        AND i.due_date < CURRENT_DATE
      THEN 'Overdue' ELSE ''
    END AS overdue,
    CASE
      WHEN i.record_status <> 'Cancelled'
        AND (i.grand_total - COALESCE(pay.received, 0)) > 0
        AND i.due_date IS NOT NULL
        AND i.due_date < CURRENT_DATE
      THEN (CURRENT_DATE - i.due_date)::integer
      ELSE NULL
    END AS days_overdue,
    replaced.invoice_no AS replaced_by_no,
    replaces.invoice_no AS replaces_no
  ${INVOICE_FROM}
`;
