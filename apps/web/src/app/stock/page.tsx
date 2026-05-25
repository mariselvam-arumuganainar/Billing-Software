"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import Topbar from "@/components/Topbar";

// ── Types ─────────────────────────────────────────────────────────────────
type EntryType = "ADD" | "DAMAGE" | "SALE" | "ADJUST";

interface StockItem {
  id: string;
  name: string;
  unit: string;
  sku?: string;
  stockQty: number;
  price: number;
  purchasePrice?: number;
  isActive: boolean;
}
interface StockEntry {
  id: string;
  type: EntryType;
  qty: number;
  notes?: string;
  createdAt: string;
  item: { name: string; unit: string };
  supplier?: { name: string } | null;
}
interface Supplier {
  id: string;
  name: string;
}
interface Dashboard {
  totalItems: number;
  outOfStock: number;
  lowStock: number;
  stockValue: number;
  recentEntries: StockEntry[];
}

// ── Formatters ────────────────────────────────────────────────────────────
const INR = (v: number) =>
  `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
function fmtDt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const TYPE_META: Record<
  EntryType,
  { label: string; color: string; sign: string }
> = {
  ADD: { label: "Stock In", color: "#10b981", sign: "+" },
  ADJUST: { label: "Adjust", color: "#a855f7", sign: "±" },
  SALE: { label: "Sale", color: "#3b82f6", sign: "−" },
  DAMAGE: { label: "Damage", color: "#ef4444", sign: "−" },
};

const BLANK_ENTRY = {
  itemId: "",
  type: "ADD" as EntryType,
  qty: "",
  notes: "",
  supplierId: "",
};
const BLANK_SUPPLIER = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
};

export default function StockPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [items, setItems] = useState<StockItem[]>([]);
  const [history, setHistory] = useState<StockEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [tab, setTab] = useState<"items" | "history">("items");

  const [showEntry, setShowEntry] = useState(false);
  const [showSupplier, setShowSupplier] = useState(false);
  const [entryForm, setEntryForm] = useState(BLANK_ENTRY);
  const [supplierForm, setSupplierForm] = useState(BLANK_SUPPLIER);
  const [saving, setSaving] = useState(false);
  const [entryError, setEntryError] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashR, itmR, histR, supR] = await Promise.all([
        apiClient.get("/stock/dashboard"),
        apiClient.get("/stock/items"),
        apiClient.get("/stock/history"),
        apiClient.get("/stock/suppliers"),
      ]);
      setDashboard(dashR.data.dashboard);
      setItems(itmR.data.items ?? []);
      setHistory(histR.data.entries ?? []);
      setSuppliers(supR.data.suppliers ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function submitEntry() {
    if (!entryForm.itemId) {
      setEntryError("Select an item");
      return;
    }
    const qty = parseFloat(entryForm.qty);
    if (!qty || qty <= 0) {
      setEntryError("Enter a valid quantity");
      return;
    }
    setSaving(true);
    setEntryError("");
    try {
      await apiClient.post("/stock/entries", {
        itemId: entryForm.itemId,
        type: entryForm.type,
        qty,
        notes: entryForm.notes || undefined,
        supplierId: entryForm.supplierId || undefined,
      });
      setShowEntry(false);
      setEntryForm(BLANK_ENTRY);
      await fetchAll();
    } catch (err: any) {
      setEntryError(err?.response?.data?.error ?? "Failed to save entry");
    }
    setSaving(false);
  }

  async function submitSupplier() {
    if (!supplierForm.name.trim()) return;
    setSaving(true);
    try {
      await apiClient.post("/stock/suppliers", supplierForm);
      setShowSupplier(false);
      setSupplierForm(BLANK_SUPPLIER);
      const r = await apiClient.get("/stock/suppliers");
      setSuppliers(r.data.suppliers ?? []);
    } catch {}
    setSaving(false);
  }

  async function deleteEntry(id: string) {
    if (
      !confirm(
        "Remove this stock entry? This will reverse the quantity change.",
      )
    )
      return;
    try {
      await apiClient.delete(`/stock/entries/${id}`);
      await fetchAll();
    } catch {}
  }

  const filteredItems = items.filter((it) => {
    const matchSearch =
      !search ||
      it.name.toLowerCase().includes(search.toLowerCase()) ||
      (it.sku ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "out" && it.stockQty <= 0) ||
      (filter === "low" && it.stockQty > 0 && it.stockQty <= 5);
    return matchSearch && matchFilter;
  });

  return (
    <div
      className="dark-app min-h-screen flex flex-col"
      style={{ background: "var(--theme-bg)" }}
    >
      <Topbar />

      <main className="flex-1 px-6 py-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              Stock Management
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Inventory tracking and ledger
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowSupplier(true);
                setShowEntry(false);
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              + Supplier
            </button>
            <button
              onClick={() => {
                setShowEntry(true);
                setShowSupplier(false);
                setEntryForm(BLANK_ENTRY);
                setEntryError("");
              }}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 transition-colors"
            >
              + Stock Entry
            </button>
          </div>
        </div>

        {/* Dashboard KPIs */}
        {dashboard && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: "Total Items",
                value: dashboard.totalItems,
                color: "#a855f7",
                isCount: true,
              },
              {
                label: "Out of Stock",
                value: dashboard.outOfStock,
                color: "#ef4444",
                isCount: true,
              },
              {
                label: "Low Stock ≤5",
                value: dashboard.lowStock,
                color: "#f59e0b",
                isCount: true,
              },
              {
                label: "Stock Value",
                value: dashboard.stockValue,
                color: "#10b981",
              },
            ].map(({ label, value, color, isCount }) => (
              <div
                key={label}
                className="rounded-2xl p-5"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                <p className="text-xs text-slate-500 mb-2 font-medium">
                  {label}
                </p>
                <p className="text-2xl font-black" style={{ color }}>
                  {isCount ? value : INR(value as number)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl mb-5 w-fit"
          style={{
            background: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {(["items", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
              style={
                tab === t
                  ? {
                      background: "var(--theme-nav-active-bg)",
                      color: "var(--accent)",
                    }
                  : { color: "rgba(26,31,54,0.50)" }
              }
            >
              {t === "items" ? "Items" : "History"}
            </button>
          ))}
        </div>

        {/* Items tab */}
        {tab === "items" && (
          <>
            <div className="flex flex-wrap gap-3 mb-4">
              <input
                placeholder="Search items or SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-48 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400"
              />
              {(["all", "low", "out"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={
                    filter === f
                      ? {
                          background: "rgba(67,97,238,0.12)",
                          color: "#3451D1",
                          border: "1px solid rgba(67,97,238,0.35)",
                        }
                      : {
                          background: "#FFFFFF",
                          color: "rgba(26,31,54,0.55)",
                          border: "1px solid rgba(0,0,0,0.08)",
                        }
                  }
                >
                  {f === "all"
                    ? "All"
                    : f === "low"
                      ? "Low Stock"
                      : "Out of Stock"}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                Loading…
              </div>
            ) : (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#FFFFFF" }}>
                      {[
                        "Item",
                        "SKU",
                        "Unit",
                        "Stock",
                        "Sale Price",
                        "Purchase Price",
                        "Stock Value",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((it) => (
                      <tr
                        key={it.id}
                        className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-white">
                          {it.name}
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                          {it.sku ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{it.unit}</td>
                        <td className="px-4 py-3">
                          <span
                            className="px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{
                              background:
                                it.stockQty <= 0
                                  ? "rgba(239,68,68,0.15)"
                                  : it.stockQty <= 5
                                    ? "rgba(245,158,11,0.15)"
                                    : "rgba(16,185,129,0.15)",
                              color:
                                it.stockQty <= 0
                                  ? "#ef4444"
                                  : it.stockQty <= 5
                                    ? "#f59e0b"
                                    : "#10b981",
                            }}
                          >
                            {it.stockQty} {it.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-800">
                          {INR(it.price)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {it.purchasePrice != null
                            ? INR(it.purchasePrice)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-emerald-400 font-semibold">
                          {INR(it.stockQty * (it.purchasePrice ?? it.price))}
                        </td>
                      </tr>
                    ))}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-slate-400"
                        >
                          No items found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* History tab */}
        {tab === "history" && (
          <div className="space-y-3">
            {history.length === 0 && !loading && (
              <div className="text-center py-16 text-slate-400">
                No stock entries yet
              </div>
            )}
            {history.map((entry) => {
              const meta = TYPE_META[entry.type];
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl group transition-all hover:bg-slate-50"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0"
                    style={{ background: meta.color + "20", color: meta.color }}
                  >
                    {meta.sign}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white">
                        {entry.item.name}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                        style={{
                          background: meta.color + "20",
                          color: meta.color,
                        }}
                      >
                        {meta.label}
                      </span>
                      {entry.supplier && (
                        <span className="text-xs text-slate-400">
                          via {entry.supplier.name}
                        </span>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {entry.notes}
                      </p>
                    )}
                    <p className="text-[11px] text-white/25 mt-1">
                      {fmtDt(entry.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className="text-lg font-black"
                      style={{ color: meta.color }}
                    >
                      {meta.sign}
                      {entry.qty} {entry.item.unit}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="opacity-0 group-hover:opacity-100 ml-2 p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Remove entry"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Stock Entry Modal ── */}
      {showEntry && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{
            background: "var(--bg-overlay)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEntry(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{
              background: "var(--theme-modal-bg)",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <h2 className="text-lg font-black text-slate-900 mb-5">
              New Stock Entry
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">
                  Item *
                </label>
                <select
                  value={entryForm.itemId}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, itemId: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm outline-none focus:border-blue-400 focus:bg-white"
                >
                  <option value="">Select item…</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} (Stock: {it.stockQty} {it.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">
                  Type *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(TYPE_META) as EntryType[]).map((t) => {
                    const m = TYPE_META[t];
                    const sel = entryForm.type === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setEntryForm((f) => ({ ...f, type: t }))}
                        className="py-2 rounded-xl text-xs font-bold transition-all"
                        style={{
                          background: sel ? m.color + "15" : "rgba(0,0,0,0.04)",
                          color: sel ? m.color : "rgba(26,31,54,0.50)",
                          border: `1px solid ${sel ? m.color + "40" : "rgba(0,0,0,0.08)"}`,
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={entryForm.qty}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, qty: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm outline-none focus:border-blue-400 focus:bg-white"
                  placeholder="0"
                />
              </div>
              {entryForm.type === "ADD" && suppliers.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">
                    Supplier
                  </label>
                  <select
                    value={entryForm.supplierId}
                    onChange={(e) =>
                      setEntryForm((f) => ({
                        ...f,
                        supplierId: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm outline-none focus:border-blue-400 focus:bg-white"
                  >
                    <option value="">No supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">
                  Notes
                </label>
                <input
                  value={entryForm.notes}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm outline-none focus:border-blue-400 focus:bg-white"
                  placeholder="Optional note…"
                />
              </div>
              {entryError && (
                <p className="text-sm text-red-400">{entryError}</p>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={submitEntry}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition-colors"
              >
                {saving ? "Saving…" : "Save Entry"}
              </button>
              <button
                onClick={() => setShowEntry(false)}
                className="px-5 py-2.5 rounded-xl font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Supplier Modal ── */}
      {showSupplier && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{
            background: "var(--bg-overlay)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSupplier(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{
              background: "var(--theme-modal-bg)",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <h2 className="text-lg font-black text-white mb-5">Add Supplier</h2>
            <div className="space-y-3">
              {[
                { key: "name", label: "Name *", placeholder: "Supplier name" },
                {
                  key: "contactName",
                  label: "Contact Person",
                  placeholder: "Contact name",
                },
                { key: "phone", label: "Phone", placeholder: "9876543210" },
                {
                  key: "email",
                  label: "Email",
                  placeholder: "supplier@email.com",
                },
                { key: "address", label: "Address", placeholder: "Address" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">
                    {label}
                  </label>
                  <input
                    value={supplierForm[key as keyof typeof supplierForm]}
                    onChange={(e) =>
                      setSupplierForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm outline-none focus:border-blue-400 focus:bg-white"
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={submitSupplier}
                disabled={saving || !supplierForm.name.trim()}
                className="flex-1 py-2.5 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition-colors"
              >
                {saving ? "Saving…" : "Add Supplier"}
              </button>
              <button
                onClick={() => setShowSupplier(false)}
                className="px-5 py-2.5 rounded-xl font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
