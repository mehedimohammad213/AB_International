"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import InvoiceSheet from "@/components/InvoiceSheet";
import { api } from "@/lib/api";
import type { Draft, Invoice, SettingsBundle } from "@/lib/types";

export default function PrintDraftPage() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<SettingsBundle | null>(null);

  useEffect(() => {
    Promise.all([api<Draft>(`/api/drafts/${params.id}`), api<SettingsBundle>("/api/settings")]).then(([draft, bundle]) => {
      setSettings(bundle);
      setInvoice({
        id: draft.id,
        serialNo: 0,
        invoiceNo: draft.draftCode,
        invoiceDate: draft.invoiceDate || "",
        dueDate: draft.dueDate,
        customerId: draft.customerId,
        customerName: draft.customerName || "",
        customerPhone: "",
        companyName: "",
        postalCode: "",
        address: "",
        email: "",
        customerRegNo: "",
        subject: draft.subject,
        terms: draft.terms,
        remarks: draft.remarks,
        subtotal: 0,
        discount: 0,
        tax: 0,
        otherCharges: draft.otherCharges,
        grandTotal: draft.estimatedTotal,
        discountRate: draft.discountRate,
        discountFixed: draft.discountFixed,
        taxMode: draft.taxMode,
        taxRate: draft.taxRate,
        taxRounding: draft.taxRounding,
        taxLabel: bundle.settings.taxLabel,
        otherChargesLabel: draft.otherChargesLabel,
        lineCount: draft.lines.length,
        recordStatus: "Draft",
        replacesNo: draft.replacesNo,
        finalizedAt: "",
        cancelledAt: null,
        cancelReason: "",
        received: 0,
        outstanding: draft.estimatedTotal,
        paymentStatus: "",
        lastPaymentDate: null,
        overdue: "",
        daysOverdue: null,
        lines: draft.lines,
      });
    });
  }, [params.id]);

  if (!invoice || !settings) return <p className="sheet-page">Loading draft…</p>;

  return (
    <div className="sheet-page">
      <div className="actions no-print" style={{ width: "min(920px, 100%)", margin: "0 auto 12px" }}>
        <button className="btn gold" type="button" onClick={() => window.print()}>Print / Save PDF</button>
        <Link className="btn ghost" href="/drafts">Back</Link>
      </div>
      <InvoiceSheet settings={settings.settings} invoice={invoice} draft />
    </div>
  );
}
