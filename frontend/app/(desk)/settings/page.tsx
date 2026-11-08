"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Settings, SettingsBundle } from "@/lib/types";

export default function SettingsPage() {
  const [bundle, setBundle] = useState<SettingsBundle | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<SettingsBundle>("/api/settings").then((data) => {
      setBundle(data);
      setForm(data.settings);
    }).catch((err) => setError(err.message));
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!form) return;
    setError("");
    setMessage("");
    try {
      const saved = await api<SettingsBundle>("/api/settings", { method: "PUT", body: JSON.stringify({
        ...form,
        taxRate: Number(form.taxRate),
        sequenceDigits: Number(form.sequenceDigits),
        nextSequence: Number(form.nextSequence),
        sequenceYear: Number(form.sequenceYear),
        nextPaymentNo: Number(form.nextPaymentNo),
        nextCustomerNo: Number(form.nextCustomerNo),
        nextDraftNo: Number(form.nextDraftNo),
        defaultDueDays: Number(form.defaultDueDays),
      }) });
      setBundle(saved);
      setForm(saved.settings);
      setMessage(`Saved. Next invoice number preview: ${saved.settings.nextInvoicePreview}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save settings.");
    }
  }

  if (!form || !bundle) return error ? <div className="alert">{error}</div> : <p>Loading settings…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Settings 設定</div>
          <h1>Invoice settings</h1>
          <p>Next invoice number: {form.nextInvoicePreview}. Last issued: {form.lastInvoiceNo || "—"}</p>
        </div>
        <button className="btn gold" type="button" onClick={save}>Save changes</button>
      </div>
      {error && <div className="alert">{error}</div>}
      {message && <div className="banner">{message}</div>}
      <section className="panel" style={{ marginTop: 0 }}>
        <h2>Numbering and defaults</h2>
        <div className="grid-2">
          <label>Prefix<input value={form.invoicePrefix} onChange={(event) => set("invoicePrefix", event.target.value)} /></label>
          <label>Next sequence<input type="number" value={form.nextSequence} onChange={(event) => set("nextSequence", Number(event.target.value))} /></label>
          <label>Default due days<input type="number" min={0} max={365} value={form.defaultDueDays} onChange={(event) => set("defaultDueDays", Number(event.target.value))} /></label>
          <label>Default terms<textarea value={form.defaultTerms} onChange={(event) => set("defaultTerms", event.target.value)} /></label>
        </div>
      </section>
      <section className="panel">
        <h2>Tax 消費税</h2>
        <div className="grid-2">
          <label>Default tax mode
            <select value={form.defaultTaxMode} onChange={(event) => set("defaultTaxMode", event.target.value)}>
              {bundle.taxModes.map((mode) => <option key={mode}>{mode}</option>)}
            </select>
          </label>
          <label>Tax rate (0.10 = 10%)<input type="number" min={0} max={0.5} step={0.001} value={form.taxRate} onChange={(event) => set("taxRate", Number(event.target.value))} /></label>
          <label>Rounding
            <select value={form.taxRounding} onChange={(event) => set("taxRounding", event.target.value)}>
              {bundle.taxRoundings.map((mode) => <option key={mode}>{mode}</option>)}
            </select>
          </label>
        </div>
      </section>
    </>
  );
}
