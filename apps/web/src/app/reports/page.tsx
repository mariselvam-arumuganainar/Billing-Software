'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import Topbar from '@/components/Topbar';

// ── Types ─────────────────────────────────────────────────────────────────
interface Summary {
  grossSales: number; netSales: number; taxCollected: number;
  expensesTotal: number; profitEstimate: number; invoiceCount: number;
}
interface GstRow    { rate: number; taxable: number; cgst: number; sgst: number; igst: number; total: number }
interface GstReport { byRate: GstRow[]; totalCgst: number; totalSgst: number; totalIgst: number; totalGst: number }
interface ItemRow   { name: string; unit: string; qtySold: number; revenue: number; profit: number; stockQty: number }
interface CustRow   { id: string; name: string; mobileNumber: string; totalPurchase: number; invoiceCount: number; lastPurchase: string | null; rewardPoints: number; creditDue: number }
interface Expense   { id: string; category: string; amount: number; date: string; description?: string }
interface CatRow    { category: string; amount: number }
interface CreditAcct { id: string; creditLimit: number; currentDue: number; customer: { name: string; mobileNumber: string } }
interface StockItem  { id: string; name: string; unit: string; stockQty: number; price: number; purchasePrice?: number }
interface StockSummary { total: number; outOfStock: number; lowStock: number; stockValue: number }
interface Invoice   { id: string; invoiceSequence: string; grandTotal: number; paymentMode: string; status: string; createdAt: string; customer?: { name?: string } }

// ── Formatters ────────────────────────────────────────────────────────────
const INR = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const MODE_COLOR: Record<string, string> = {
  CASH: '#10b981', CARD: '#3b82f6', UPI: '#8b5cf6', CREDIT: '#f43f5e', SPLIT: '#f59e0b',
};

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 print:mb-6 print:break-inside-avoid">
      <h2 className="text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200 print:text-black print:border-gray-300">{title}</h2>
      {children}
    </section>
  );
}

function Tbl({ heads, rows }: { heads: string[]; rows: (string | number | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#FFFFFF' }}>
            {heads.map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider print:text-gray-500 print:bg-gray-50">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors print:border-gray-200">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-slate-700 print:text-gray-800">{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={heads.length} className="px-4 py-6 text-center text-slate-400 text-sm print:text-gray-400">No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const today     = new Date().toISOString().slice(0, 10);
  const monthAgo  = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(monthAgo);
  const [endDate, setEndDate]     = useState(today);
  const [loading, setLoading]     = useState(false);

  const [summary, setSummary]           = useState<Summary | null>(null);
  const [paymentSplit, setPaymentSplit]  = useState<Record<string, number>>({});
  const [gst, setGst]                   = useState<GstReport | null>(null);
  const [items, setItems]               = useState<ItemRow[]>([]);
  const [customers, setCustomers]       = useState<CustRow[]>([]);
  const [expenses, setExpenses]         = useState<Expense[]>([]);
  const [byCategory, setByCategory]     = useState<CatRow[]>([]);
  const [expTotal, setExpTotal]         = useState(0);
  const [creditAccts, setCreditAccts]   = useState<CreditAcct[]>([]);
  const [creditTotals, setCreditTotals] = useState({ totalDue: 0, overdueCount: 0 });
  const [stockItems, setStockItems]     = useState<StockItem[]>([]);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [invoices, setInvoices]         = useState<Invoice[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const q = `?startDate=${startDate}&endDate=${endDate}`;
    try {
      const [sumR, gstR, itmR, cusR, expR, creR, stkR, invR] = await Promise.all([
        apiClient.get(`/reports/summary${q}`),
        apiClient.get(`/reports/gst${q}`),
        apiClient.get(`/reports/items${q}`),
        apiClient.get('/reports/customers'),
        apiClient.get(`/reports/expenses${q}`),
        apiClient.get('/reports/credit'),
        apiClient.get('/reports/stock'),
        apiClient.get(`/reports/invoices${q}`),
      ]);
      setSummary(sumR.data.summary);
      setPaymentSplit(sumR.data.paymentSplit ?? {});
      setGst(gstR.data.gst);
      setItems(itmR.data.items ?? []);
      setCustomers(cusR.data.customers ?? []);
      setExpenses(expR.data.expenses ?? []);
      setByCategory(expR.data.byCategory ?? []);
      setExpTotal(expR.data.total ?? 0);
      setCreditAccts(creR.data.accounts ?? []);
      setCreditTotals({ totalDue: creR.data.totalDue ?? 0, overdueCount: creR.data.overdueCount ?? 0 });
      setStockItems(stkR.data.items ?? []);
      setStockSummary(stkR.data.stockSummary ?? null);
      setInvoices(invR.data.invoices ?? []);
    } catch {}
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div className="dark-app min-h-screen flex flex-col" style={{ background: 'var(--theme-bg)' }}>
      <Topbar printHidden />

      <main className="flex-1 px-6 py-6 max-w-7xl mx-auto w-full">
        {/* ── Page header + controls ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 print:hidden">
          <div>
            <h1 className="text-2xl font-black text-white">Reports</h1>
            <p className="text-sm text-slate-400 mt-0.5">Business analytics and export</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              From
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-sm outline-none focus:border-blue-400" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              To
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-sm outline-none focus:border-blue-400" />
            </label>
            <button onClick={fetchAll}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors">
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button onClick={() => window.print()}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)' }}>
              Print / Export PDF
            </button>
          </div>
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-black text-black">Business Reports</h1>
          <p className="text-sm text-gray-500">{fmtDate(startDate)} – {fmtDate(endDate)}</p>
        </div>

        {/* ── 1. Sales Summary ── */}
        {summary && (
          <Section title="Sales Summary">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              {[
                { label: 'Gross Sales',   value: summary.grossSales,     color: '#f97316' },
                { label: 'Net Sales',     value: summary.netSales,       color: '#10b981' },
                { label: 'Tax Collected', value: summary.taxCollected,   color: '#0ea5e9' },
                { label: 'Expenses',      value: summary.expensesTotal,  color: '#f43f5e' },
                { label: 'Profit Est.',   value: summary.profitEstimate, color: '#a855f7' },
                { label: 'Invoices',      value: summary.invoiceCount,   color: '#f59e0b', isCount: true },
              ].map(({ label, value, color, isCount }) => (
                <div key={label} className="rounded-xl p-4 print:border print:border-gray-200"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <p className="text-xs text-slate-500 mb-1 print:text-gray-500">{label}</p>
                  <p className="text-lg font-black" style={{ color }}>{isCount ? value : INR(value)}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(paymentSplit).filter(([, v]) => v > 0).map(([mode, amt]) => (
                <span key={mode} className="px-3 py-1.5 rounded-full text-xs font-bold"
                  style={{ background: MODE_COLOR[mode] + '30', border: `1px solid ${MODE_COLOR[mode]}50`, color: MODE_COLOR[mode] }}>
                  {mode}: {INR(amt)}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* ── 2. GST Report ── */}
        {gst && (
          <Section title="GST Report">
            <Tbl
              heads={['GST Rate', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax']}
              rows={[
                ...gst.byRate.map(r => [
                  `${r.rate}%`, INR(r.taxable), INR(r.cgst), INR(r.sgst), INR(r.igst), INR(r.total),
                ]),
                ['Total', '', INR(gst.totalCgst), INR(gst.totalSgst), INR(gst.totalIgst), <strong key="gt">{INR(gst.totalGst)}</strong>],
              ]}
            />
          </Section>
        )}

        {/* ── 3. Item Sales Report ── */}
        <Section title="Item Sales">
          <Tbl
            heads={['Item', 'Unit', 'Qty Sold', 'Revenue', 'Profit Est.', 'Current Stock']}
            rows={items.map(it => [
              it.name, it.unit,
              it.qtySold.toLocaleString('en-IN'),
              INR(it.revenue),
              <span key="p" style={{ color: it.profit >= 0 ? '#10b981' : '#f43f5e' }}>{INR(it.profit)}</span>,
              <span key="s" style={{ color: it.stockQty <= 0 ? '#ef4444' : it.stockQty <= 5 ? '#f59e0b' : '#10b981' }}>
                {it.stockQty}
              </span>,
            ])}
          />
        </Section>

        {/* ── 4. Customer Report ── */}
        <Section title="Customer Report">
          <Tbl
            heads={['Customer', 'Mobile', 'Total Purchase', 'Invoices', 'Last Purchase', 'Rewards', 'Credit Due']}
            rows={customers.map(c => [
              c.name, c.mobileNumber,
              INR(c.totalPurchase),
              c.invoiceCount,
              c.lastPurchase ? fmtDate(c.lastPurchase) : '—',
              c.rewardPoints,
              c.creditDue > 0
                ? <span key="cd" className="font-semibold text-red-400">{INR(c.creditDue)}</span>
                : <span key="cd" className="text-emerald-400">—</span>,
            ])}
          />
        </Section>

        {/* ── 5. Expense Report ── */}
        <Section title="Expenses">
          <div className="flex flex-wrap gap-2 mb-4">
            {byCategory.map(c => (
              <span key={c.category} className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700"
                style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)' }}>
                {c.category}: {INR(c.amount)}
              </span>
            ))}
            <span className="px-3 py-1.5 rounded-full text-xs font-bold text-red-400"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
              Total: {INR(expTotal)}
            </span>
          </div>
          <Tbl
            heads={['Date', 'Category', 'Description', 'Amount']}
            rows={expenses.slice(0, 50).map(e => [
              fmtDate(e.date), e.category, e.description ?? '—', INR(e.amount),
            ])}
          />
        </Section>

        {/* ── 6. Credit Report ── */}
        <Section title="Credit Accounts">
          <div className="flex gap-3 mb-4">
            <div className="px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)' }}>
              <p className="text-xs text-slate-500 mb-1">Total Outstanding</p>
              <p className="font-black text-red-400">{INR(creditTotals.totalDue)}</p>
            </div>
            <div className="px-4 py-3 rounded-xl text-sm"
              style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)' }}>
              <p className="text-xs text-slate-500 mb-1">Overdue Accounts</p>
              <p className="font-black text-amber-400">{creditTotals.overdueCount}</p>
            </div>
          </div>
          <Tbl
            heads={['Customer', 'Mobile', 'Credit Limit', 'Current Due', 'Available']}
            rows={creditAccts.map(a => [
              a.customer.name, a.customer.mobileNumber,
              INR(a.creditLimit),
              <span key="d" style={{ color: a.currentDue > 0 ? '#f43f5e' : '#10b981', fontWeight: 600 }}>{INR(a.currentDue)}</span>,
              INR(Math.max(0, a.creditLimit - a.currentDue)),
            ])}
          />
        </Section>

        {/* ── 7. Stock Report ── */}
        {stockSummary && (
          <Section title="Stock Report">
            <div className="flex flex-wrap gap-3 mb-4">
              {[
                { label: 'Total Items',   value: stockSummary.total,        color: '#a855f7', isCount: true },
                { label: 'Out of Stock',  value: stockSummary.outOfStock,   color: '#ef4444', isCount: true },
                { label: 'Low Stock ≤5', value: stockSummary.lowStock,     color: '#f59e0b', isCount: true },
                { label: 'Stock Value',   value: stockSummary.stockValue,   color: '#10b981' },
              ].map(({ label, value, color, isCount }) => (
                <div key={label} className="px-4 py-3 rounded-xl"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className="font-black" style={{ color }}>{isCount ? value : INR(value as number)}</p>
                </div>
              ))}
            </div>
            <Tbl
              heads={['Item', 'Unit', 'Stock', 'Sale Price', 'Purchase Price', 'Value']}
              rows={stockItems.slice(0, 50).map(it => [
                it.name, it.unit,
                <span key="sq" style={{ color: it.stockQty <= 0 ? '#ef4444' : it.stockQty <= 5 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>{it.stockQty}</span>,
                INR(it.price),
                it.purchasePrice != null ? INR(it.purchasePrice) : '—',
                INR(it.stockQty * (it.purchasePrice ?? it.price)),
              ])}
            />
          </Section>
        )}

        {/* ── 8. Invoice List ── */}
        <Section title="Invoice List">
          <Tbl
            heads={['Invoice #', 'Date', 'Customer', 'Payment', 'Status', 'Amount']}
            rows={invoices.slice(0, 100).map(inv => [
              inv.invoiceSequence,
              fmtDate(inv.createdAt),
              inv.customer?.name ?? '—',
              <span key="pm" className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                style={{ background: MODE_COLOR[inv.paymentMode] + '25', color: MODE_COLOR[inv.paymentMode] }}>
                {inv.paymentMode}
              </span>,
              <span key="st" className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                style={{
                  background: inv.status === 'COMPLETED' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                  color: inv.status === 'COMPLETED' ? '#10b981' : '#f59e0b',
                }}>
                {inv.status}
              </span>,
              INR(inv.grandTotal),
            ])}
          />
        </Section>
      </main>
    </div>
  );
}
