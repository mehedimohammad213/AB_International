"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StatusPill from "@/components/StatusPill";
import { api } from "@/lib/api";
import { yen, ymd } from "@/lib/format";
import type { Invoice } from "@/lib/types";

const statuses = ["All", "Unpaid", "Partially Paid", "Paid", "Overpaid", "Overdue", "Cancelled"];

export default function InvoicesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Invoice[]>([]);

  function load(next = { q, status, from, to }) {
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.status) params.set("status", next.status);
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    api<Invoice[]>(`/api/invoices?${params.toString()}`).then(setRows);
  }

  useEffect(() => {
    load();
    // initial register load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <button className="btn" type="button" onClick={() => load()}>Apply filter</button>
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>No.</th><th>Date</th><th>Customer</th><th>Subject</th>
                <th className="num">Total</th><th className="num">Received</th><th className="num">Outstanding</th>
                <th>Payment</th><th>Due</th><th>Record</th><th>Overdue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((invoice) => (
                <tr key={invoice.id}>
                  <td><Link href={`/invoices/${invoice.id}`}><strong>{invoice.invoiceNo}</strong></Link></td>
                  <td>{ymd(invoice.invoiceDate)}</td>
                  <td>{invoice.customerName}</td>
                  <td>{invoice.subject}</td>
                  <td className="num">{yen(invoice.grandTotal)}</td>
                  <td className="num">{yen(invoice.received)}</td>
                  <td className="num">{yen(invoice.outstanding)}</td>
                  <td><StatusPill value={invoice.paymentStatus} /></td>
                  <td>{ymd(invoice.dueDate)}</td>
                  <td><StatusPill value={invoice.recordStatus} /></td>
                  <td>{invoice.overdue ? `${invoice.overdue}${invoice.daysOverdue ? ` · ${invoice.daysOverdue}d` : ""}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
