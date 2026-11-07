"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import StatusPill from "@/components/StatusPill";
import { api, ApiError, send } from "@/lib/api";
import { stamp, todayIso, yen, ymd } from "@/lib/format";
import type { Invoice, Payment, SettingsBundle } from "@/lib/types";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [methods, setMethods] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [amount, setAmount] = useState<number | "">("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [reverseReason, setReverseReason] = useState("");

  function load() {
    Promise.all([
      api<Invoice>(`/api/invoices/${params.id}`),
      api<SettingsBundle>("/api/settings"),
    ])
      .then(([doc, bundle]) => {
        setInvoice(doc);
        setMethods(bundle.methods);
        setMethod((current) => current || bundle.methods[0] || "");
      })
      .catch((err) => {
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

  async function recordPayment() {
    if (!invoice) return;
    setError("");
    try {
      await send("/api/payments", {
        invoiceNo: invoice.invoiceNo,
        paymentDate,
        amount: Number(amount),
        method,
        reference,
        remarks,
      });
      setAmount("");
      setReference("");
      setRemarks("");
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status !== 409) setError(err.message);
    }
  }

  async function reverse(payment: Payment) {
    const why = reverseReason.trim() || window.prompt(`Reason for reversing ${payment.paymentCode}`) || "";
    if (!why.trim()) return;
    setError("");
    try {
      await api(`/api/payments/${payment.id}/reverse`, { method: "POST", body: JSON.stringify({ reason: why }) });
      setReverseReason("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reverse the payment.");
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
        {invoice.recordStatus === "Issued" && (
          <div className="row" style={{ marginBottom: 12 }}>
            <label>Payment date *<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
            <label>Amount ¥ *<input type="number" step="1" min="1" value={amount} onChange={(event) => setAmount(event.target.value === "" ? "" : Number(event.target.value))} /></label>
            <label>Method *
              <select value={method} onChange={(event) => setMethod(event.target.value)}>
                {methods.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>Reference<input value={reference} onChange={(event) => setReference(event.target.value)} /></label>
            <label>Remarks<input value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
            <button className="btn gold" type="button" onClick={recordPayment}>Record payment</button>
          </div>
        )}
        <div className="row" style={{ marginBottom: 12 }}>
          <label>Reason used when reversing<input value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} placeholder="Required for Reverse" /></label>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Date</th><th className="num">Amount</th><th>Method</th><th>Type</th><th>Status</th><th>Note</th><th></th></tr></thead>
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
                  <td>
                    {payment.status === "Active" && (payment.entryType === "Payment" || payment.entryType === "Transfer") && (
                      <button className="btn ghost" type="button" onClick={() => reverse(payment)}>Reverse</button>
                    )}
                  </td>
                </tr>
              ))}
              {(invoice.payments || []).length === 0 && (
                <tr><td colSpan={8}>No payments recorded yet.</td></tr>
              )}
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
