"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import StatusPill from "@/components/StatusPill";
import { api, ApiError } from "@/lib/api";
import { stamp, yen, ymd } from "@/lib/format";
import type { Payment, PaymentPage, SettingsBundle } from "@/lib/types";

const PAGE_SIZE = 20;
const entryTypes = ["All", "Payment", "Reversal", "Transfer"];
const statuses = ["All", "Active", "Reversed"];

type Query = {
  q: string;
  entryType: string;
  status: string;
  method: string;
  from: string;
  to: string;
  page: number;
};

export default function PaymentsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [entryType, setEntryType] = useState("All");
  const [status, setStatus] = useState("All");
  const [method, setMethod] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [methods, setMethods] = useState<string[]>([]);
  const [query, setQuery] = useState<Query>({
    q: "",
    entryType: "All",
    status: "All",
    method: "All",
    from: "",
    to: "",
    page: 1,
  });
  const [rows, setRows] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersApplied, setFiltersApplied] = useState(false);

  useEffect(() => {
    api<SettingsBundle>("/api/settings")
      .then((bundle) => setMethods(bundle.methods || []))
      .catch(() => undefined);
  }, []);

  const load = useCallback(async (next: Query) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(next.page),
        pageSize: String(PAGE_SIZE),
        entryType: next.entryType,
        status: next.status,
        method: next.method,
      });
      if (next.q.trim()) params.set("q", next.q.trim());
      if (next.from) params.set("from", next.from);
      if (next.to) params.set("to", next.to);
      const data = await api<PaymentPage | Payment[]>(`/api/payments?${params.toString()}`);
      if (Array.isArray(data)) {
        setRows(data);
        setTotal(data.length);
      } else {
        setRows(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(query).catch(() => undefined);
  }, [load, query]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function applyFilters() {
    setFiltersApplied(true);
    setQuery({ q, entryType, status, method, from, to, page: 1 });
  }

  function resetFilters() {
    setQ("");
    setEntryType("All");
    setStatus("All");
    setMethod("All");
    setFrom("");
    setTo("");
    setFiltersApplied(false);
    setQuery({ q: "", entryType: "All", status: "All", method: "All", from: "", to: "", page: 1 });
  }

  function note(payment: Payment) {
    const parts = [payment.remarks, payment.flag, payment.reversesCode ? `reverses ${payment.reversesCode}` : ""]
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.join(" · ") || "—";
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Payments 入金履歴</div>
          <h1>Payment log</h1>
          <p>Every recorded payment, reversal and transfer across finalized invoices.</p>
        </div>
      </div>
      {error && <div className="alert">{error}</div>}
      <section className="panel" style={{ marginTop: 0 }}>
        <div className="row">
          <label>
            Search
            <input
              value={q}
              placeholder="Payment, invoice, customer, reference"
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
          <label>
            Type
            <select value={entryType} onChange={(event) => setEntryType(event.target.value)}>
              {entryTypes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Method
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              <option>All</option>
              {methods.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <button className="btn" type="button" onClick={applyFilters}>
            Apply filter
          </button>
          {filtersApplied && (
            <button className="btn ghost" type="button" onClick={resetFilters}>
              Reset
            </button>
          )}
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Payment</th>
                <th>Date</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th className="num">Amount</th>
                <th>Method</th>
                <th>Type</th>
                <th>Status</th>
                <th className="wrap">Note</th>
                <th>Recorded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((payment) => (
                <tr
                  key={payment.id}
                  className="click"
                  onClick={() => router.push(`/invoices/${payment.invoiceId}`)}
                >
                  <td>
                    <strong>{payment.paymentCode}</strong>
                  </td>
                  <td>{ymd(payment.paymentDate)}</td>
                  <td>{payment.invoiceNo || "—"}</td>
                  <td>{payment.customerName}</td>
                  <td className="num">{yen(payment.amount)}</td>
                  <td>{payment.method}</td>
                  <td>
                    <StatusPill value={payment.entryType} />
                  </td>
                  <td>
                    <StatusPill value={payment.status} />
                  </td>
                  <td className="wrap">{note(payment)}</td>
                  <td>{stamp(payment.recordedAt)}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="wrap muted">
                    No payments match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <span className="note">
            {loading ? "Loading…" : `${total} payment${total === 1 ? "" : "s"}`}
            {!loading && total > 0 ? ` · page ${query.page} of ${pageCount}` : ""}
          </span>
          <div className="actions">
            <button
              className="btn ghost"
              type="button"
              disabled={query.page <= 1 || loading}
              onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
            >
              Previous
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={query.page >= pageCount || loading}
              onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
