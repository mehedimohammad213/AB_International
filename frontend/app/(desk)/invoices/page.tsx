"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import StatusPill from "@/components/StatusPill";
import { api, ApiError } from "@/lib/api";
import { yen } from "@/lib/format";
import type { Invoice } from "@/lib/types";

const statuses = ["All", "Unpaid", "Partially Paid", "Paid", "Overpaid", "Overdue", "Cancelled"];

export default function InvoicesPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Invoice[]>([]);
  const [error, setError] = useState("");
  const [filtersApplied, setFiltersApplied] = useState(false);

  function load(next = { q, status, from, to }) {
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.status) params.set("status", next.status);
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    api<Invoice[]>(`/api/invoices?${params.toString()}`)
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load invoices."));
  }

  useEffect(() => {
    load();
    // initial register load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters() {
    setFiltersApplied(true);
    load({ q, status, from, to });
  }

  function resetFilters() {
    setQ("");
    setStatus("All");
    setFrom("");
    setTo("");
    setFiltersApplied(false);
    load({ q: "", status: "All", from: "", to: "" });
  }

  async function remove(invoice: Invoice) {
    if (!window.confirm(`Delete ${invoice.invoiceNo} (${invoice.customerName})?`)) return;
    setError("");
    try {
      await api(`/api/invoices/${invoice.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the invoice.");
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Invoice Register 請求書台帳</div>
          <h1>Finalized invoices</h1>
          <p>Payments update the balance. Issued numbers stay on the record.</p>
        </div>
        <Link className="btn gold" href="/invoices/new">New invoice</Link>
      </div>
      {error && <div className="alert">{error}</div>}
      <section className="panel" style={{ marginTop: 0 }}>
        <div className="row">
          <label>Search<input value={q} placeholder="Invoice no. or customer" onChange={(event) => setQ(event.target.value)} /></label>
          <label>Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statuses.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <button className="btn" type="button" onClick={applyFilters}>Apply filter</button>
          {filtersApplied && (
            <button className="btn ghost" type="button" onClick={resetFilters}>Reset</button>
          )}
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Customer</th>
                <th className="num">Total</th>
                <th className="num">Received</th>
                <th className="num">Outstanding</th>
                <th>Payment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="click"
                  onClick={() => router.push(`/invoices/${invoice.id}`)}
                >
                  <td><strong>{invoice.invoiceNo}</strong></td>
                  <td>{invoice.customerName}</td>
                  <td className="num">{yen(invoice.grandTotal)}</td>
                  <td className="num">{yen(invoice.received)}</td>
                  <td className="num">{yen(invoice.outstanding)}</td>
                  <td><StatusPill value={invoice.paymentStatus} /></td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <div className="actions icon-actions">
                      <button
                        className="icon-btn"
                        type="button"
                        title="View"
                        aria-label={`View ${invoice.invoiceNo}`}
                        onClick={() => router.push(`/invoices/${invoice.id}`)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" strokeWidth="1.7" />
                          <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
                        </svg>
                      </button>
                      <button
                        className="icon-btn"
                        type="button"
                        title="Edit"
                        aria-label={`Edit ${invoice.invoiceNo}`}
                        disabled={invoice.recordStatus !== "Issued"}
                        onClick={() => router.push(`/invoices/${invoice.id}/edit`)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                          <path d="M12.8 6.7l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button
                        className="icon-btn danger"
                        type="button"
                        title="Delete"
                        aria-label={`Delete ${invoice.invoiceNo}`}
                        onClick={() => remove(invoice)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 7h14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                          <path d="M9 7V5h6v2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                          <path d="M8 7l.8 12h6.4L16 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                          <path d="M10.5 11v5M13.5 11v5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
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
