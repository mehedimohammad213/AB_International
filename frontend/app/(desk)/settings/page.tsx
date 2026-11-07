"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Settings, SettingsBundle } from "@/lib/types";

export default function SettingsPage() {
  const [bundle, setBundle] = useState<SettingsBundle | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [methods, setMethods] = useState("");
  const [units, setUnits] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<SettingsBundle>("/api/settings").then((data) => {
      setBundle(data);
      setForm(data.settings);
      setMethods(data.methods.join("\n"));
      setUnits(data.units.join("\n"));
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
      const lists = await api<SettingsBundle>("/api/settings/lists", {
        method: "PUT",
        body: JSON.stringify({
          methods: methods.split("\n"),
          units: units.split("\n"),
        }),
      });
      setBundle(lists);
      setForm(saved.settings);
      setMessage(`Saved. Next invoice number preview: ${lists.settings.nextInvoicePreview}`);
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
          <h1>Company and numbering</h1>
          <p>Currency stays Japanese yen. Amounts are whole yen. Next number: {form.nextInvoicePreview}</p>
        </div>
        <button className="btn gold" type="button" onClick={save}>Save changes</button>
      </div>
      {error && <div className="alert">{error}</div>}
      {message && <div className="banner">{message}</div>}
      <section className="panel" style={{ marginTop: 0 }}>
        <h2>Company 会社情報</h2>
        <div className="grid-2">
          <label>Company name (Japanese)<input value={form.companyNameJa} onChange={(event) => set("companyNameJa", event.target.value)} /></label>
          <label>Company name (English)<input value={form.companyNameEn} onChange={(event) => set("companyNameEn", event.target.value)} /></label>
          <label>Postal code<input value={form.postalCode} onChange={(event) => set("postalCode", event.target.value)} /></label>
          <label>Address<input value={form.address} onChange={(event) => set("address", event.target.value)} /></label>
          <label>TEL / FAX<input value={form.telFax} onChange={(event) => set("telFax", event.target.value)} /></label>
          <label>Mobile<input value={form.mobile} onChange={(event) => set("mobile", event.target.value)} /></label>
          <label>Email<input value={form.email} onChange={(event) => set("email", event.target.value)} /></label>
          <label>Registration no. 登録番号<input value={form.registrationNo} onChange={(event) => set("registrationNo", event.target.value)} /></label>
        </div>
      </section>
      <section className="panel">
        <h2>Bank details 振込先</h2>
        <div className="grid-2">
          <label>Bank and branch<input value={form.bankBranch} onChange={(event) => set("bankBranch", event.target.value)} /></label>
          <label>Account type and number<input value={form.accountTypeNumber} onChange={(event) => set("accountTypeNumber", event.target.value)} /></label>
          <label>Account name<input value={form.accountName} onChange={(event) => set("accountName", event.target.value)} /></label>
          <label>Transfer note<input value={form.transferNote} onChange={(event) => set("transferNote", event.target.value)} /></label>
        </div>
      </section>
      <section className="panel">
        <h2>Invoice text and numbering</h2>
        <div className="grid-2">
          <label>Document title<input value={form.documentTitle} onChange={(event) => set("documentTitle", event.target.value)} /></label>
          <label>Subtitle<input value={form.documentSubtitle} onChange={(event) => set("documentSubtitle", event.target.value)} /></label>
          <label>Intro sentence<input value={form.introSentence} onChange={(event) => set("introSentence", event.target.value)} /></label>
          <label>Default terms<textarea value={form.defaultTerms} onChange={(event) => set("defaultTerms", event.target.value)} /></label>
          <label>Prefix<input value={form.invoicePrefix} onChange={(event) => set("invoicePrefix", event.target.value)} /></label>
          <label>Separator<input value={form.separator} onChange={(event) => set("separator", event.target.value)} /></label>
          <label>Year format
            <select value={form.yearFormat} onChange={(event) => set("yearFormat", event.target.value as Settings["yearFormat"])}>
              <option>YYYY</option><option>YY</option><option>None</option>
            </select>
          </label>
          <label>Sequence digits<input type="number" min={3} max={8} value={form.sequenceDigits} onChange={(event) => set("sequenceDigits", Number(event.target.value))} /></label>
          <label>Restart each year
            <select value={form.restartEachYear ? "Yes" : "No"} onChange={(event) => set("restartEachYear", event.target.value === "Yes")}>
              <option>Yes</option><option>No</option>
            </select>
          </label>
          <label>Default due days<input type="number" min={0} max={365} value={form.defaultDueDays} onChange={(event) => set("defaultDueDays", Number(event.target.value))} /></label>
          <label>Next sequence<input type="number" value={form.nextSequence} onChange={(event) => set("nextSequence", Number(event.target.value))} /></label>
          <label>Sequence year<input type="number" value={form.sequenceYear} onChange={(event) => set("sequenceYear", Number(event.target.value))} /></label>
          <label>Next payment no.<input type="number" value={form.nextPaymentNo} onChange={(event) => set("nextPaymentNo", Number(event.target.value))} /></label>
          <label>Next customer no.<input type="number" value={form.nextCustomerNo} onChange={(event) => set("nextCustomerNo", Number(event.target.value))} /></label>
          <label>Next draft no.<input type="number" value={form.nextDraftNo} onChange={(event) => set("nextDraftNo", Number(event.target.value))} /></label>
        </div>
        <p className="note">Last issued: {form.lastInvoiceNo || "—"}. Change the counters only when you know why.</p>
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
          <label>Tax label<input value={form.taxLabel} onChange={(event) => set("taxLabel", event.target.value)} /></label>
          <label>Rounding
            <select value={form.taxRounding} onChange={(event) => set("taxRounding", event.target.value)}>
              {bundle.taxRoundings.map((mode) => <option key={mode}>{mode}</option>)}
            </select>
          </label>
        </div>
        <p className="note">Tax is off by default. Confirm the rate with your accountant. 10% is Japan’s standard consumption-tax rate.</p>
      </section>
      <section className="panel">
        <h2>Lists</h2>
        <div className="grid-2">
          <label>Payment methods, one per line<textarea value={methods} onChange={(event) => setMethods(event.target.value)} /></label>
          <label>Units, one per line<textarea value={units} onChange={(event) => setUnits(event.target.value)} /></label>
        </div>
      </section>
    </>
  );
}
