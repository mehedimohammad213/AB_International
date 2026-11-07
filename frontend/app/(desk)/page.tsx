"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { MONTHS, yen } from "@/lib/format";
import type { Dashboard } from "@/lib/types";

export default function DashboardPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>(`/api/dashboard?year=${year}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "The API is not running."));
  }, [year]);

  const max = Math.max(1, ...(data?.months.map((month) => Math.max(month.invoiceValue, month.paymentsReceived)) || [1]));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Dashboard 経営サマリー</div>
          <h1>Invoicing and collections</h1>
          <p>Japanese yen. Cancelled invoices are excluded from the totals.</p>
        </div>
        <label>Year
          <input type="number" value={year} onChange={(event) => setYear(Number(event.target.value) || year)} />
        </label>
      </div>
      {error && <div className="alert">{error}</div>}
      {data && (
        <>
          <div className="cards">
            <article className="card"><span>Finalized invoices</span><strong>{data.finalizedInvoices}</strong></article>
            <article className="card"><span>Total invoiced</span><strong>{yen(data.totalInvoiced)}</strong></article>
            <article className="card"><span>Payments received</span><strong>{yen(data.paymentsReceived)}</strong></article>
            <article className="card"><span>Outstanding</span><strong>{yen(data.outstanding)}</strong></article>
            <article className="card"><span>Unpaid</span><strong>{data.unpaid}</strong></article>
            <article className="card"><span>Partially paid</span><strong>{data.partiallyPaid}</strong></article>
            <article className="card"><span>Fully paid</span><strong>{data.fullyPaid}</strong></article>
            <article className="card"><span>Overdue</span><strong>{data.overdueInvoices}</strong><em>{yen(data.overdueReceivables)} outstanding</em></article>
          </div>
          <section className="panel">
            <h2>Monthly summary 月次サマリー · {data.year}</h2>
            <p className="note">Payments are cash received in the month, for any invoice. Outstanding is the current balance of invoices issued that month.</p>
            <div className="bars">
              {data.months.map((month) => (
                <div className="bar-row" key={month.month}>
                  <span>{MONTHS[month.month - 1]}</span>
                  <div className="track" title={`Invoiced ${yen(month.invoiceValue)} / collected ${yen(month.paymentsReceived)}`}>
                    <i className="invoiced" style={{ width: `${(month.invoiceValue / max) * 100}%` }} />
                  </div>
                  <span>{month.invoicesIssued} inv</span>
                </div>
              ))}
            </div>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">Invoices</th>
                    <th className="num">Invoice value</th>
                    <th className="num">Payments received</th>
                    <th className="num">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((month) => (
                    <tr key={month.month}>
                      <td>{MONTHS[month.month - 1]}</td>
                      <td className="num">{month.invoicesIssued}</td>
                      <td className="num">{yen(month.invoiceValue)}</td>
                      <td className="num">{yen(month.paymentsReceived)}</td>
                      <td className="num">{yen(month.outstanding)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Year total</td>
                    <td className="num">{data.months.reduce((sum, month) => sum + month.invoicesIssued, 0)}</td>
                    <td className="num">{yen(data.months.reduce((sum, month) => sum + month.invoiceValue, 0))}</td>
                    <td className="num">{yen(data.months.reduce((sum, month) => sum + month.paymentsReceived, 0))}</td>
                    <td className="num">{yen(data.months.reduce((sum, month) => sum + month.outstanding, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {data.paymentsOutsideYear !== 0 && (
              <p className="note">Payments dated in other years: {yen(data.paymentsOutsideYear)}.</p>
            )}
            <p className="note">Cancelled invoices excluded above: {data.cancelled}</p>
          </section>
        </>
      )}
    </>
  );
}
