"use client";

import { useEffect, useState } from "react";
import StatusPill from "@/components/StatusPill";
import { api, ApiError, send } from "@/lib/api";
import { todayIso, yen, ymd } from "@/lib/format";
import type { Invoice, Payment, SettingsBundle } from "@/lib/types";

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [amount, setAmount] = useState<number | "">("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");

  const selected = invoices.find((invoice) => invoice.invoiceNo === invoiceNo);

  async function load() {
    const [issued, bundle, log] = await Promise.all([
      api<Invoice[]>("/api/invoices?status=All"),
      api<SettingsBundle>("/api/settings"),
      api<Payment[]>("/api/payments"),
    ]);
    setInvoices(issued.filter((invoice) => invoice.recordStatus === "Issued"));
    setMethods(bundle.methods);
    setMethod((current) => current || bundle.methods[0] || "");
    setPayments(log);
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  async function record() {
    setError("");
    try {
      await send("/api/payments", {
        invoiceNo,
        paymentDate,
        amount: Number(amount),
        method,
        reference,
        remarks,
      });
      setAmount("");
      setReference("");
      setRemarks("");
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status !== 409) setError(err.message);
    }
  }

  async function reverse(payment: Payment) {
    const why = reason.trim() || window.prompt(`Reason for reversing ${payment.paymentCode}`) || "";
    if (!why.trim()) return;
    setError("");
    try {
      await api(`/api/payments/${payment.id}/reverse`, { method: "POST", body: JSON.stringify({ reason: why }) });
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reverse the payment.");
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Payment Log 入金記録</div>
          <h1>Payments</h1>
          <p>Partial payments are allowed. Corrections add a reversal. Nothing is deleted.</p>
        </div>
      </div>
      {error && <div className="alert">{error}</div>}
      <section className="panel" style={{ marginTop: 0 }}>
        <h2>Record a payment 入金登録</h2>
        <div className="row">
          <label>Invoice *
            <select value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)}>
              <option value="">Choose</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.invoiceNo}>
                  {invoice.invoiceNo} · {invoice.customerName} · due {yen(invoice.outstanding)}
                </option>
              ))}
            </select>
          </label>
          <label>Payment date *<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
          <label>Amount ¥ *<input type="number" step="1" min="1" value={amount} onChange={(event) => setAmount(event.target.value === "" ? "" : Number(event.target.value))} /></label>
          <label>Method *
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              {methods.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>Reference<input value={reference} onChange={(event) => setReference(event.target.value)} /></label>
          <label>Remarks<input value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
          <button className="btn gold" type="button" onClick={record}>Record payment</button>
        </div>
        {selected && <p className="note">Outstanding on {selected.invoiceNo}: {yen(selected.outstanding)} · status {selected.paymentStatus}</p>}
      </section>
      <section className="panel">
        <div className="row">
          <label>Reason used when reversing<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for Reverse" /></label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Invoice</th><th>Customer</th><th>Date</th><th className="num">Amount</th><th>Method</th><th>Type</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.paymentCode}</td>
                  <td>{payment.invoiceNo}</td>
                  <td>{payment.customerName}</td>
                  <td>{ymd(payment.paymentDate)}</td>
                  <td className="num">{yen(payment.amount)}</td>
                  <td>{payment.method}</td>
                  <td><StatusPill value={payment.entryType} /></td>
                  <td><StatusPill value={payment.status} /> {payment.flag}</td>
                  <td>
                    {payment.status === "Active" && (payment.entryType === "Payment" || payment.entryType === "Transfer") && (
                      <button className="btn ghost" type="button" onClick={() => reverse(payment)}>Reverse</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
