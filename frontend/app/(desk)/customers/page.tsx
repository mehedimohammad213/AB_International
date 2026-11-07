"use client";

import { useCallback, useEffect, useState } from "react";
import CustomerDrawer from "@/components/CustomerDrawer";
import { api, ApiError, send } from "@/lib/api";
import type { Customer, CustomerInput, CustomerPage } from "@/lib/types";

const PAGE_SIZE = 10;

const filters = [
  { value: "all", label: "All customers" },
  { value: "duplicates", label: "Duplicates" },
  { value: "missing_email", label: "Missing email" },
  { value: "missing_phone", label: "Missing phone" },
  { value: "has_company", label: "Has company" },
];

type Query = { q: string; filter: string; from: string; to: string; page: number };

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState<Query>({ q: "", filter: "all", from: "", to: "", page: 1 });
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filtersApplied, setFiltersApplied] = useState(false);

  const load = useCallback(async (next: Query) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(next.page),
        pageSize: String(PAGE_SIZE),
        filter: next.filter,
      });
      if (next.q.trim()) params.set("q", next.q.trim());
      if (next.from) params.set("from", next.from);
      if (next.to) params.set("to", next.to);
      const data = await api<CustomerPage | Customer[]>(`/api/customers?${params.toString()}`);
      if (Array.isArray(data)) {
        setRows(data);
        setTotal(data.length);
      } else {
        setRows(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(query).catch(() => undefined);
  }, [load, query]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
    setError("");
    setMessage("");
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setDrawerOpen(true);
    setError("");
    setMessage("");
  }

  function closeDrawer() {
    if (saving) return;
    setDrawerOpen(false);
    setEditing(null);
  }

  async function save(form: CustomerInput) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (editing) {
        await send<Customer>(`/api/customers/${editing.id}`, form, "PUT");
        setMessage(`${editing.customerCode} updated. Issued invoices keep their original snapshot.`);
        setDrawerOpen(false);
        setEditing(null);
        await load(query);
      } else {
        const created = await send<Customer>("/api/customers", form);
        setMessage(`${created.customerCode} added.`);
        setDrawerOpen(false);
        setEditing(null);
        const next = { ...query, page: 1 };
        setQuery(next);
        if (query.page === 1) await load(next);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status !== 409) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(customer: Customer) {
    if (!window.confirm(`Delete ${customer.customerCode} (${customer.name})?`)) return;
    setError("");
    setMessage("");
    try {
      await api(`/api/customers/${customer.id}`, { method: "DELETE" });
      setMessage(`${customer.customerCode} deleted.`);
      const nextPage = rows.length === 1 && query.page > 1 ? query.page - 1 : query.page;
      const next = { ...query, page: nextPage };
      setQuery(next);
      if (nextPage === query.page) await load(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete customer.");
    }
  }

  function applyFilters() {
    setFiltersApplied(true);
    setQuery({ q, filter, from, to, page: 1 });
  }

  function resetFilters() {
    setQ("");
    setFilter("all");
    setFrom("");
    setTo("");
    setFiltersApplied(false);
    setQuery({ q: "", filter: "all", from: "", to: "", page: 1 });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Customer List 顧客一覧</div>
          <h1>Customers</h1>
          <p>Each customer keeps a permanent ID. Invoices store their own copy of the details.</p>
        </div>
        <button className="btn gold" type="button" onClick={openCreate}>Add customer</button>
      </div>

      {!drawerOpen && error && <div className="alert">{error}</div>}
      {message && <div className="banner">{message}</div>}

      <section className="panel" style={{ marginTop: 0 }}>
        <div className="row">
          <label>Search
            <input
              value={q}
              placeholder="Code, name, phone, email…"
              onChange={(event) => setQ(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
            />
          </label>
          <label>Filter
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              {filters.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>From
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>To
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <button className="btn" type="button" onClick={applyFilters}>Apply</button>
          {filtersApplied && (
            <button className="btn ghost" type="button" onClick={resetFilters}>Reset</button>
          )}
        </div>

        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Company</th>
                <th>Postal</th>
                <th className="wrap">Address</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Reg. no.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <strong>{customer.customerCode}</strong>
                    {customer.duplicateNamePhone ? " · duplicate" : customer.duplicateName ? " · same name" : ""}
                  </td>
                  <td>{customer.name}</td>
                  <td>{customer.companyName}</td>
                  <td>{customer.postalCode}</td>
                  <td className="wrap">{customer.address}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.email}</td>
                  <td>{customer.taxRegNo}</td>
                  <td>
                    <div className="actions icon-actions">
                      <button className="icon-btn" type="button" title="Edit" aria-label={`Edit ${customer.customerCode}`} onClick={() => openEdit(customer)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                          <path d="M12.8 6.7l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button className="icon-btn danger" type="button" title="Delete" aria-label={`Delete ${customer.customerCode}`} onClick={() => remove(customer)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 7h14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                          <path d="M9 7V5h6v2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                          <path d="M8 7l.8 12h6.4L16 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                          <path d="M10.5 11v5M13.5 11v5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="wrap muted">No customers match this search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <span className="note">
            {loading ? "Loading…" : `${total} customer${total === 1 ? "" : "s"}`}
            {!loading && total > 0 ? ` · page ${query.page} of ${pageCount}` : ""}
          </span>
          <div className="actions">
            <button
              className="btn ghost"
              type="button"
              disabled={query.page <= 1 || loading}
              onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
            >
              Previous
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={query.page >= pageCount || loading}
              onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <CustomerDrawer
        open={drawerOpen}
        customer={editing}
        saving={saving}
        error={drawerOpen ? error : ""}
        onClose={closeDrawer}
        onSave={save}
      />
    </>
  );
}
