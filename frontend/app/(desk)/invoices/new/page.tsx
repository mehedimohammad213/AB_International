"use client";

import { useEffect, useState } from "react";
import InvoiceForm from "@/components/InvoiceForm";
import { api } from "@/lib/api";
import type { Customer, SettingsBundle } from "@/lib/types";

export default function NewInvoicePage() {
  const [bundle, setBundle] = useState<SettingsBundle | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    Promise.all([api<SettingsBundle>("/api/settings"), api<Customer[]>("/api/customers")]).then(([settings, people]) => {
      setBundle(settings);
      setCustomers(people);
    });
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Invoice Entry 請求書作成</div>
          <h1>New invoice</h1>
          <p>Save a draft at any time. Finalize issues the permanent number, starting at {bundle?.settings.nextInvoicePreview || "…"}.</p>
        </div>
      </div>
      {bundle && <InvoiceForm customers={customers} units={bundle.units} settings={bundle.settings} />}
    </>
  );
}
