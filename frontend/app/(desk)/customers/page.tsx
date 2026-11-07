"use client";

import { useEffect, useState } from "react";
import { api, ApiError, send } from "@/lib/api";
import { stamp } from "@/lib/format";
import type { Customer } from "@/lib/types";

const blank = {
  name: "",
  companyName: "",
  postalCode: "",
  address: "",
  phone: "",
  email: "",
  taxRegNo: "",
  remarks: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setCustomers(await api<Customer[]>("/api/customers"));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Could not load customers."));
  }, []);

  function set<K extends keyof typeof blank>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setError("");
    setMessage("");
    try {
      if (editing) {
        await send<Customer>(`/api/customers/${editing.id}`, form, "PUT");
        setMessage(`${editing.customerCode} updated. Issued invoices keep their original snapshot.`);
      } else {
        const created = await send<Customer>("/api/customers", form);
        setMessage(`${created.customerCode} added.`);
      }
      setForm(blank);
      setEditing(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status !== 409) setError(err.message);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Customer List 顧客一覧</div>
          <h1>Customers</h1>
          <p>Each customer keeps a permanent ID. Invoices store their own copy of the details.</p>
        </div>
      </div>
      {error && <div className="alert">{error}</div>}
      {message && <div className="banner">{message}</div>}
      <section className="panel" style={{ marginTop: 0 }}>
        <h2>{editing ? `Edit ${editing.customerCode}` : "Add a new customer 新規顧客登録"}</h2>
        <div className="grid-2">
          <label>Customer name *<input value={form.name} onChange={(event) => set("name", event.target.value)} /></label>
          <label>Company name<input value={form.companyName} onChange={(event) => set("companyName", event.target.value)} /></label>
          <label>Postal code<input value={form.postalCode} onChange={(event) => set("postalCode", event.target.value)} /></label>
          <label>Address<input value={form.address} onChange={(event) => set("address", event.target.value)} /></label>
          <label>Phone<input value={form.phone} onChange={(event) => set("phone", event.target.value)} /></label>
          <label>Email<input value={form.email} onChange={(event) => set("email", event.target.value)} /></label>
          <label>Tax / reg. no.<input value={form.taxRegNo} onChange={(event) => set("taxRegNo", event.target.value)} /></label>
          <label>Remarks<input value={form.remarks} onChange={(event) => set("remarks", event.target.value)} /></label>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn gold" type="button" onClick={save}>{editing ? "Save changes" : "Add customer"}</button>
          {editing && <button className="btn ghost" type="button" onClick={() => { setEditing(null); setForm(blank); }}>Cancel edit</button>}
        </div>
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Company</th><th>Postal</th><th>Address</th><th>Phone</th><th>Email</th><th>Reg. no.</th><th>Created</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="click" onClick={() => {
                  setEditing(customer);
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
                }}>
                  <td>{customer.customerCode}{customer.duplicateNamePhone ? " · duplicate" : ""}</td>
                  <td>{customer.name}</td>
                  <td>{customer.companyName}</td>
                  <td>{customer.postalCode}</td>
                  <td>{customer.address}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.email}</td>
                  <td>{customer.taxRegNo}</td>
                  <td>{stamp(customer.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
