"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import StatusPill from "@/components/StatusPill";
import { api, ApiError } from "@/lib/api";
import { stamp, yen, ymd } from "@/lib/format";
import type { Invoice } from "@/lib/types";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function load() {
    api<Invoice>(`/api/invoices/${params.id}`).then(setInvoice).catch((err) => {
      setError(err instanceof ApiError ? err.message : "Invoice not found.");
    });
  }

  useEffect(() => { load(); }, [params.id]);

  async function cancel() {
    setError("");
    try {
      await api(`/api/invoices/${params.id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
      setReason("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel.");
    }
  }

  async function reissue() {
    setError("");
    try {
      const draft = await api<{ id: number }>(`/api/invoices/${params.id}/reissue`, { method: "POST" });
      router.push(`/drafts/${draft.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reissue.");
    }
  }

  if (!invoice) return error ? <div className="alert">{error}</div> : <p>Loading…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Invoice {invoice.invoiceNo}</div>
          <h1>{invoice.customerName}</h1>
          <p>{ymd(invoice.invoiceDate)} · due {ymd(invoice.dueDate)} · finalized {stamp(invoice.finalizedAt)}</p>
        </div>
        <div className="actions">
          <Link className="btn gold" href={`/invoices/${invoice.id}/print`}>Print / PDF</Link>
          {invoice.recordStatus === "Issued" && <button className="btn ghost" type="button" onClick={reissue}>Correct / reissue</button>}
        </div>
      </div>
      {error && <div className="alert">{error}</div>}
      <div className="cards">
        <article className="card"><span>Grand total</span><strong>{yen(invoice.grandTotal)}</strong></article>
        <article className="card"><span>Received</span><strong>{yen(invoice.received)}</strong></article>
        <article className="card"><span>Outstanding</span><strong>{yen(invoice.outstanding)}</strong></article>
        <article className="card"><span>Status</span><strong><StatusPill value={invoice.paymentStatus} /></strong>{invoice.overdue && <em>{invoice.overdue} · {invoice.daysOverdue} days</em>}</article>
      </div>
      <section className="panel">
        <h2>Snapshot</h2>
        <p>
          <StatusPill value={invoice.recordStatus} /> {invoice.customerCode} · {invoice.companyName} · {invoice.postalCode} {invoice.address}
          <br />{invoice.customerPhone} · {invoice.email} · {invoice.customerRegNo}
        </p>
        <p>Subject: {invoice.subject || "—"}<br />Tax: {invoice.taxMode} · rate {(invoice.taxRate * 100).toFixed(1)}% · {invoice.taxRounding}</p>
        {invoice.replacesNo && <p>Replaces {invoice.replacesNo}</p>}
        {invoice.replacedByNo && <p>Replaced by {invoice.replacedByNo}</p>}
        {invoice.cancelReason && <p>Cancel reason: {invoice.cancelReason}</p>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>No.</th><th>Description</th><th className="num">Qty</th><th>Unit</th><th className="num">Price</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {(invoice.lines || []).map((line) => (
                <tr key={line.lineNo}>
                  <td>{line.lineNo}</td><td>{line.description}</td><td className="num">{line.qty}</td><td>{line.unit}</td>
                  <td className="num">{yen(line.unitPrice)}</td><td className="num">{yen(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Payments</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Date</th><th className="num">Amount</th><th>Method</th><th>Type</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>
              {(invoice.payments || []).map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.paymentCode}</td>
                  <td>{ymd(payment.paymentDate)}</td>
                  <td className="num">{yen(payment.amount)}</td>
                  <td>{payment.method}</td>
                  <td><StatusPill value={payment.entryType} /></td>
                  <td><StatusPill value={payment.status} /> {payment.flag}</td>
                  <td>{payment.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {invoice.recordStatus === "Issued" && (
          <div className="row" style={{ marginTop: 12 }}>
            <label>Cancel reason<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <button className="btn danger" type="button" onClick={cancel}>Cancel invoice</button>
          </div>
        )}
        <p className="note">Cancel is blocked while a balance of payments remains. Reverse them, or reissue to move them.</p>
      </section>
    </>
  );
}
