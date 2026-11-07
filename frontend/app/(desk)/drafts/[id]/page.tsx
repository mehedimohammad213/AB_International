"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import InvoiceForm from "@/components/InvoiceForm";
import { api } from "@/lib/api";
import type { Customer, Draft, SettingsBundle } from "@/lib/types";

export default function DraftEditorPage() {
  const params = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<SettingsBundle | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    Promise.all([
      api<SettingsBundle>("/api/settings"),
      api<Customer[]>("/api/customers"),
      api<Draft>(`/api/drafts/${params.id}`),
    ]).then(([settings, people, saved]) => {
      setBundle(settings);
      setCustomers(people);
      setDraft(saved);
    });
  }, [params.id]);

  if (!bundle || !draft) return <p>Loading draft…</p>;
  if (draft.status !== "Open") {
    return <p>This draft is {draft.status.toLowerCase()} and can no longer be edited.</p>;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">{draft.draftCode}</div>
          <h1>Continue draft</h1>
          <p>Open drafts stay out of the register until you finalize them.</p>
        </div>
      </div>
      <InvoiceForm customers={customers} units={bundle.units} settings={bundle.settings} draft={draft} />
    </>
  );
}
