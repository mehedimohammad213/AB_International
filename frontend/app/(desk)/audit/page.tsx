"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { stamp } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";

export default function AuditPage() {
  const [rows, setRows] = useState<AuditEntry[]>([]);

  useEffect(() => {
    api<AuditEntry[]>("/api/audit").then(setRows);
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Audit Log 操作履歴</div>
          <h1>What changed</h1>
          <p>Finalizing, cancellations, payments, reversals and customer changes are recorded with the name in the sidebar.</p>
        </div>
      </div>
      <section className="panel" style={{ marginTop: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Document</th><th className="wrap">Details</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{stamp(row.occurredAt)}</td>
                  <td>{row.operatorName}</td>
                  <td>{row.action}</td>
                  <td>{row.document}</td>
                  <td className="wrap">{row.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
