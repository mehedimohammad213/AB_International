"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { addDays, todayIso, yen } from "@/lib/format";
import { computeTotals } from "@/lib/totals";
import type { Customer, Draft, Invoice, Line, Settings } from "@/lib/types";

type Props = {
  customers: Customer[];
  units: string[];
  settings: Settings;
  draft?: Draft | null;
  invoice?: Invoice | null;
};

const emptyLine = (): Line => ({ description: "", qty: 1, unit: "unit", unitPrice: null });

function initialLines(draft?: Draft | null, invoice?: Invoice | null) {
  if (invoice?.lines?.length) return invoice.lines;
  if (draft?.lines?.length) return draft.lines;
  return [emptyLine(), emptyLine(), emptyLine()];
}

export default function InvoiceForm({ customers, units, settings, draft, invoice }: Props) {
  const router = useRouter();
  const editingInvoice = Boolean(invoice);
  const creatingInvoice = !invoice && !draft;
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoiceDate || draft?.invoiceDate || todayIso());
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate || draft?.dueDate || addDays(todayIso(), settings.defaultDueDays)
  );
  const [customerId, setCustomerId] = useState<number | "">(invoice?.customerId || draft?.customerId || "");
  const [subject, setSubject] = useState(invoice?.subject || draft?.subject || "");
  const [terms, setTerms] = useState(invoice?.terms || draft?.terms || settings.defaultTerms);
  const [remarks, setRemarks] = useState(invoice?.remarks || draft?.remarks || "");
  const [discountPercent, setDiscountPercent] = useState(
    invoice ? invoice.discountRate * 100 : draft ? draft.discountRate * 100 : 0
  );
  const [discountFixed, setDiscountFixed] = useState(invoice?.discountFixed || draft?.discountFixed || 0);
  const [taxMode, setTaxMode] = useState(invoice?.taxMode || draft?.taxMode || settings.defaultTaxMode);
  const [taxRate, setTaxRate] = useState(invoice ? invoice.taxRate : draft ? draft.taxRate : settings.taxRate);
  const [taxRounding, setTaxRounding] = useState(invoice?.taxRounding || draft?.taxRounding || settings.taxRounding);
  const [otherLabel, setOtherLabel] = useState(invoice?.otherChargesLabel || draft?.otherChargesLabel || "");
  const [otherCharges, setOtherCharges] = useState(invoice?.otherCharges || draft?.otherCharges || 0);
  const [lines, setLines] = useState<Line[]>(initialLines(draft, invoice));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(draft?.id || null);

  const customer = customers.find((item) => item.id === customerId);
  const totals = useMemo(() => {
    const filled = lines.filter((line) => line.description.trim() && line.qty && line.unitPrice != null);
    return computeTotals({
      lines: filled.map((line) => ({
        description: line.description,
        qty: Number(line.qty),
        unit: line.unit,
        unitPrice: Number(line.unitPrice),
      })),
      discountPercent: Number(discountPercent) || 0,
      discountFixed: Number(discountFixed) || 0,
      taxMode,
      taxRate: Number(taxRate) || 0,
      taxRounding,
      otherCharges: Number(otherCharges) || 0,
    });
  }, [lines, discountPercent, discountFixed, taxMode, taxRate, taxRounding, otherCharges]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function payload() {
    return {
      invoiceDate: invoiceDate || null,
      dueDate: dueDate || null,
      customerId: customerId || null,
      subject,
      terms,
      remarks,
      discountPercent: Number(discountPercent) || 0,
      discountFixed: Number(discountFixed) || 0,
      taxMode,
      taxRate: Number(taxRate) || 0,
      taxRounding,
      otherChargesLabel: otherLabel,
      otherCharges: Number(otherCharges) || 0,
      lines: lines.map((line) => ({
        description: line.description,
        qty: line.qty === null || line.qty === undefined || Number.isNaN(Number(line.qty)) ? null : Number(line.qty),
        unit: line.unit,
        unitPrice: line.unitPrice === null || line.unitPrice === undefined || line.unitPrice === ("" as unknown as number) ? null : Number(line.unitPrice),
      })),
    };
  }

  async function saveDraft() {
    setBusy(true);
    setError("");
    try {
      const saved = draftId
        ? await api<Draft>(`/api/drafts/${draftId}`, { method: "PUT", body: JSON.stringify(payload()) })
        : await api<Draft>("/api/drafts", { method: "POST", body: JSON.stringify(payload()) });
      setDraftId(saved.id);
      router.replace(`/drafts/${saved.id}`);
      return saved;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the draft.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveInvoice() {
    if (!invoice) return;
    if (!window.confirm(`Save changes to ${invoice.invoiceNo}? The invoice number stays the same.`)) return;
    setBusy(true);
    setError("");
    try {
      await api<Invoice>(`/api/invoices/${invoice.id}`, { method: "PUT", body: JSON.stringify(payload()) });
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the invoice.");
      setBusy(false);
    }
  }

  async function finalize(redirectToList = false) {
    if (!creatingInvoice) {
      const message = draft?.replacesNo
        ? `Finalize this correction? It receives a new invoice number. ${draft.replacesNo} will be marked Cancelled and its payments will move to the new invoice.`
        : "Finalize this invoice? The number is permanent and the invoice cannot be edited.";
      if (!window.confirm(message)) return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = draftId
        ? await api<Draft>(`/api/drafts/${draftId}`, { method: "PUT", body: JSON.stringify(payload()) })
        : await api<Draft>("/api/drafts", { method: "POST", body: JSON.stringify(payload()) });
      const result = await api<{ id: number }>(`/api/drafts/${saved.id}/finalize`, { method: "POST" });
      router.push(redirectToList || creatingInvoice ? "/invoices" : `/invoices/${result.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : creatingInvoice ? "Could not create the invoice." : "Could not finalize the invoice.");
      setBusy(false);
    }
  }

  async function discard() {
    if (!draftId || !window.confirm("Discard this draft? It will not receive an invoice number.")) return;
    setBusy(true);
    try {
      await api(`/api/drafts/${draftId}/discard`, { method: "POST" });
      router.push("/drafts");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not discard the draft.");
      setBusy(false);
    }
  }

  return (
    <div className="grid-3">
      <section className="panel" style={{ marginTop: 0 }}>
        {error && <div className="alert">{error}</div>}
        {draft?.replacesNo && (
          <div className="banner">This draft replaces {draft.replacesNo}. Finalizing cancels that invoice and transfers its payments.</div>
        )}
        <div className="row">
          <label>Date<input type="date" value={invoiceDate} onChange={(event) => {
            setInvoiceDate(event.target.value);
            if (event.target.value) setDueDate(addDays(event.target.value, settings.defaultDueDays));
          }} /></label>
          <label>Due date 支払期限<input type="date" value={dueDate || ""} onChange={(event) => setDueDate(event.target.value)} /></label>
          {!creatingInvoice && (
            <label>
              {editingInvoice
                ? `Invoice ${invoice?.invoiceNo}`
                : `Draft ${draft?.draftCode || (draftId ? `#${draftId}` : "not saved")}`}
            </label>
          )}
        </div>
        <div style={{ height: 12 }} />
        <label>Customer
          <select value={customerId} onChange={(event) => setCustomerId(event.target.value ? Number(event.target.value) : "")}>
            <option value="">Choose a customer</option>
            {customers.map((item) => (
              <option key={item.id} value={item.id}>{item.customerCode} | {item.name}{item.companyName ? ` (${item.companyName})` : ""}</option>
            ))}
          </select>
        </label>
        {customer && (
          <p className="note">
            {customer.companyName} {customer.postalCode} {customer.address} · {customer.phone} · {customer.email}
            <br />
            {editingInvoice
              ? "Saving refreshes the customer snapshot on this invoice."
              : creatingInvoice
                ? "The invoice keeps a snapshot of these details when you create it."
                : "The invoice keeps a snapshot of these details when you finalize."}
          </p>
        )}
        <div style={{ height: 12 }} />
        <label>Subject 件名<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
        <div style={{ height: 12 }} />
        <label>Terms 支払条件<textarea value={terms} onChange={(event) => setTerms(event.target.value)} /></label>
        <div style={{ height: 12 }} />
        <label>Remarks 備考<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
        <div style={{ height: 16 }} />
        <h2>Items 明細</h2>
        <div className="table-wrap lines">
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Description 品名</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Unit price ¥</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const amount = line.description && line.qty && line.unitPrice != null
                  ? Math.round(Number(line.qty) * Number(line.unitPrice))
                  : 0;
                return (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td><input value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} /></td>
                    <td><input type="number" min="0" step="0.001" value={line.qty ?? ""} onChange={(event) => updateLine(index, { qty: event.target.value === "" ? null : Number(event.target.value) })} /></td>
                    <td>
                      <input list="units" value={line.unit} onChange={(event) => updateLine(index, { unit: event.target.value })} />
                    </td>
                    <td><input type="number" step="1" value={line.unitPrice ?? ""} onChange={(event) => updateLine(index, { unitPrice: event.target.value === "" ? null : Number(event.target.value) })} /></td>
                    <td className="num">{yen(amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id="units">{units.map((unit) => <option key={unit} value={unit} />)}</datalist>
        </div>
        <div className="actions" style={{ marginTop: 10 }}>
          <button className="btn ghost" type="button" disabled={lines.length >= 30} onClick={() => setLines((current) => [...current, emptyLine()])}>Add line</button>
          {lines.length > 1 && <button className="btn ghost" type="button" onClick={() => setLines((current) => current.slice(0, -1))}>Remove last line</button>}
        </div>
      </section>

      <aside className="panel" style={{ marginTop: 0 }}>
        <h2>Totals</h2>
        <label>Discount %<input type="number" min="0" max="100" step="0.01" value={discountPercent} onChange={(event) => setDiscountPercent(Number(event.target.value))} /></label>
        <div style={{ height: 8 }} />
        <label>Discount fixed ¥<input type="number" min="0" step="1" value={discountFixed} onChange={(event) => setDiscountFixed(Number(event.target.value))} /></label>
        <div style={{ height: 8 }} />
        <label>Tax mode
          <select value={taxMode} onChange={(event) => setTaxMode(event.target.value)}>
            <option>Not applied</option>
            <option>Exclusive (add to prices)</option>
            <option>Inclusive (prices include tax)</option>
          </select>
        </label>
        <div style={{ height: 8 }} />
        <label>Tax rate
          <input type="number" min="0" max="0.5" step="0.001" value={taxRate} onChange={(event) => setTaxRate(Number(event.target.value))} />
        </label>
        <p className="note">Enter 0.10 for 10%. Inclusive prices already contain tax. Exclusive adds tax on top. Rounding: {taxRounding}.</p>
        <label>Rounding
          <select value={taxRounding} onChange={(event) => setTaxRounding(event.target.value)}>
            <option>Round down</option>
            <option>Round</option>
            <option>Round up</option>
          </select>
        </label>
        <div style={{ height: 8 }} />
        <label>Other charges label<input value={otherLabel} onChange={(event) => setOtherLabel(event.target.value)} /></label>
        <div style={{ height: 8 }} />
        <label>Other charges ¥<input type="number" step="1" value={otherCharges} onChange={(event) => setOtherCharges(Number(event.target.value))} /></label>
        <div className="totals" style={{ marginTop: 16 }}>
          <div><span>Subtotal</span><span>{yen(totals.subtotal)}</span></div>
          <div><span>Discount</span><span>{yen(totals.discount)}</span></div>
          <div><span>{settings.taxLabel}</span><span>{yen(totals.tax)}</span></div>
          <div><span>Other</span><span>{yen(totals.otherCharges)}</span></div>
          <div className="grand"><span>Grand total</span><span>{yen(totals.grandTotal)}</span></div>
        </div>
        <div className="actions" style={{ marginTop: 16 }}>
          {editingInvoice ? (
            <>
              <button className="btn ghost" type="button" disabled={busy} onClick={() => router.push(`/invoices/${invoice?.id}`)}>Cancel</button>
              <button className="btn gold" type="button" disabled={busy} onClick={saveInvoice}>Save changes</button>
            </>
          ) : creatingInvoice ? (
            <button className="btn gold" type="button" disabled={busy} onClick={() => finalize(true)}>
              {busy ? "Creating…" : "Create invoice"}
            </button>
          ) : (
            <>
              <button className="btn ghost" type="button" disabled={busy} onClick={saveDraft}>Save draft</button>
              <button className="btn gold" type="button" disabled={busy} onClick={() => finalize()}>Finalize invoice</button>
              {draftId && <button className="btn danger" type="button" disabled={busy} onClick={discard}>Discard</button>}
            </>
          )}
        </div>
        <p className="note">
          {editingInvoice
            ? "Edits keep the same invoice number. Payments already recorded stay attached."
            : creatingInvoice
              ? "Creates the invoice with a permanent number, then returns to the register."
              : "Saving a draft does not issue a number. Finalized numbers are never reused."}
        </p>
      </aside>
    </div>
  );
}
