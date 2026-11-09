"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import InvoiceSheet from "@/components/InvoiceSheet";
import { api } from "@/lib/api";
import { printDocument } from "@/lib/print";
import type { Invoice, SettingsBundle } from "@/lib/types";

export default function PrintInvoicePage() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<SettingsBundle | null>(null);

  useEffect(() => {
    Promise.all([api<Invoice>(`/api/invoices/${params.id}`), api<SettingsBundle>("/api/settings")]).then(async ([doc, bundle]) => {
      setInvoice(doc);
      setSettings(bundle);
      await api(`/api/invoices/${doc.id}/print-log`, { method: "POST" }).catch(() => null);
    });
  }, [params.id]);

  if (!invoice || !settings) return <p className="sheet-page">Loading invoice…</p>;

  return (
    <div className="sheet-page">
      <div className="actions no-print" style={{ width: "min(920px, 100%)", margin: "0 auto 12px" }}>
        <button className="btn gold" type="button" onClick={printDocument}>Print / Save PDF</button>
        <Link className="btn ghost" href={`/invoices/${invoice.id}`}>Back to invoice</Link>
      </div>
      <InvoiceSheet settings={settings.settings} invoice={invoice} />
    </div>
  );
}
