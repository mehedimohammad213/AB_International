"use client";

import { useEffect, useState } from "react";
import type { Customer, CustomerInput } from "@/lib/types";

const blank: CustomerInput = {
  name: "",
  companyName: "",
  postalCode: "",
  address: "",
  phone: "",
  email: "",
  taxRegNo: "",
  remarks: "",
};

type Props = {
  open: boolean;
  customer: Customer | null;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onSave: (form: CustomerInput) => Promise<void>;
};

export default function CustomerDrawer({ open, customer, saving, error, onClose, onSave }: Props) {
  const [form, setForm] = useState<CustomerInput>(blank);

  useEffect(() => {
    if (!open) return;
    if (customer) {
      setForm({
        name: customer.name,
        companyName: customer.companyName,
        postalCode: customer.postalCode,
        address: customer.address,
        phone: customer.phone,
        email: customer.email,
        taxRegNo: customer.taxRegNo,
        remarks: customer.remarks,
      });
    } else {
      setForm(blank);
    }
  }, [open, customer]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  function set<K extends keyof CustomerInput>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  if (!open) return null;

  return (
    <div className="drawer-root" role="presentation">
      <button className="drawer-backdrop" type="button" aria-label="Close" onClick={onClose} disabled={saving} />
      <aside className="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="customer-drawer-title">
        <div className="drawer-head">
          <div>
            <div className="kicker">{customer ? customer.customerCode : "New customer"}</div>
            <h2 id="customer-drawer-title">{customer ? "Edit customer" : "Add customer"}</h2>
            <p className="note">{customer ? "Issued invoices keep their original snapshot." : "Each customer gets a permanent ID."}</p>
          </div>
          <button className="btn ghost" type="button" onClick={onClose} disabled={saving}>Close</button>
        </div>
        <div className="drawer-body">
          {error && <div className="alert">{error}</div>}
          <div className="grid-2">
            <label>Customer name *<input value={form.name} onChange={(event) => set("name", event.target.value)} autoFocus /></label>
            <label>Company name<input value={form.companyName} onChange={(event) => set("companyName", event.target.value)} /></label>
            <label>Postal code<input value={form.postalCode} onChange={(event) => set("postalCode", event.target.value)} /></label>
            <label>Phone<input value={form.phone} onChange={(event) => set("phone", event.target.value)} /></label>
            <label className="span-2">Address<input value={form.address} onChange={(event) => set("address", event.target.value)} /></label>
            <label>Email<input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} /></label>
            <label>Tax / reg. no.<input value={form.taxRegNo} onChange={(event) => set("taxRegNo", event.target.value)} /></label>
            <label className="span-2">Remarks<textarea value={form.remarks} onChange={(event) => set("remarks", event.target.value)} /></label>
          </div>
        </div>
        <div className="drawer-foot">
          <button className="btn ghost" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="btn gold"
            type="button"
            disabled={saving || !form.name.trim()}
            onClick={() => onSave(form)}
          >
            {saving ? "Saving…" : customer ? "Save changes" : "Add customer"}
          </button>
        </div>
      </aside>
    </div>
  );
}
