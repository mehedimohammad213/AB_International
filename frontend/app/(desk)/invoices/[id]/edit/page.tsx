"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import InvoiceForm from "@/components/InvoiceForm";
import { api, ApiError } from "@/lib/api";
import type { Customer, Invoice, SettingsBundle } from "@/lib/types";

export default function EditInvoicePage() {
  const params = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<SettingsBundle | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<SettingsBundle>("/api/settings"),
      api<Customer[]>("/api/customers"),
      api<Invoice>(`/api/invoices/${params.id}`),
    ])
      .then(([settings, people, doc]) => {
        setBundle(settings);
        setCustomers(people);
        setInvoice(doc);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Could not load the invoice.");
      });
  }, [params.id]);

  if (error) return <div className="alert">{error}</div>;
  if (!bundle || !invoice) return <p>Loading invoice…</p>;
  if (invoice.recordStatus !== "Issued") {
    return (
      <>
        <div className="alert">Only issued invoices can be edited.</div>
        <Link className="btn ghost" href={`/invoices/${invoice.id}`}>Back to invoice</Link>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Edit invoice 請求書編集</div>
          <h1>{invoice.invoiceNo}</h1>
          <p>Same layout as create. Saving keeps this invoice number.</p>
        </div>
        <Link className="btn ghost" href={`/invoices/${invoice.id}`}>View invoice</Link>
      </div>
      <InvoiceForm
        customers={customers}
        units={bundle.units}
        methods={bundle.methods}
        settings={bundle.settings}
        invoice={invoice}
      />
    </>
  );
}
