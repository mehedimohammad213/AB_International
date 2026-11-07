"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StatusPill from "@/components/StatusPill";
import { api } from "@/lib/api";
import { stamp, yen, ymd } from "@/lib/format";
import type { Draft } from "@/lib/types";

export default function DraftsPage() {
  const [rows, setRows] = useState<Draft[]>([]);
  const [status, setStatus] = useState("Open");

  useEffect(() => {
    api<Draft[]>(`/api/drafts?status=${encodeURIComponent(status)}`).then(setRows);
  }, [status]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Drafts 下書き</div>
          <h1>Unfinalized invoices</h1>
          <p>Drafts have no invoice number and are not part of receivables.</p>
        </div>
        <label>Show
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option>Open</option>
            <option>Finalized</option>
            <option>Discarded</option>
            <option>All</option>
          </select>
        </label>
      </div>
      <section className="panel" style={{ marginTop: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Draft</th><th>Saved</th><th>Status</th><th>Date</th><th>Customer</th><th>Subject</th><th className="num">Estimate</th><th>Replaces</th></tr>
            </thead>
            <tbody>
              {rows.map((draft) => (
                <tr key={draft.id}>
                  <td><Link href={draft.status === "Open" ? `/drafts/${draft.id}` : `/drafts/${draft.id}/print`}><strong>{draft.draftCode}</strong></Link></td>
                  <td>{stamp(draft.savedAt)}</td>
                  <td><StatusPill value={draft.status} /></td>
                  <td>{ymd(draft.invoiceDate)}</td>
                  <td>{draft.customerName || "—"}</td>
                  <td>{draft.subject}</td>
                  <td className="num">{yen(draft.estimatedTotal)}</td>
                  <td>{draft.replacesNo || ""}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8}>No drafts in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
