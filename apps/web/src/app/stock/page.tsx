'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import Topbar from '@/components/Topbar';

// ── Types ─────────────────────────────────────────────────────────────────
interface StockItem {
  id: string; name: string; unit: string; sku?: string | null;
  hsnSac?: string | null; stockQty: number; price: number;
  purchasePrice?: number | null; lowStockThreshold: number; isActive: boolean;
}
interface StockPurchase {
  id: string; supplierName: string; qty: number; costPerUnit: number;
  totalCost: number; date: string; item: { name: string; unit: string };
}
interface StockHistoryEntry {
  id: string; changeType: string; quantityChange: number;
  previousQty: number; newQty: number; reason?: string | null; date: string;
}
interface Stats {
  totalProducts: number; totalStockValue: number;
  lowStockCount: number; outOfStockCount: number;
}
type Tab = 'inventory' | 'purchases' | 'history';
type AdjustType = 'STOCK_IN' | 'STOCK_OUT' | 'CORRECTION';

// ── Formatters ────────────────────────────────────────────────────────────
const INR = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDt = (s: string) => new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });

// ── Status badge ─────────────────────────────────────────────────────────
function StockBadge({ item }: { item: StockItem }) {
  if (item.stockQty <= 0) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Out of Stock</span>;
  if (item.stockQty <= item.lowStockThreshold) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Low Stock</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">In Stock</span>;
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function StockPage() {
  const [tab, setTab] = useState<Tab>('inventory');
  const [items, setItems] = useState<StockItem[]>([]);
  const [purchases, setPurchases] = useState<StockPurchase[]>([]);
  const [history, setHistory] = useState<StockHistoryEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, totalStockValue: 0, lowStockCount: 0, outOfStockCount: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Adjust modal
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'STOCK_IN' as AdjustType, qty: '', reason: '', date: new Date().toISOString().slice(0, 10) });
  const [adjusting, setAdjusting] = useState(false);

  // Purchase modal
  const [showPurchase, setShowPurchase] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({ itemId: '', supplierName: '', qty: '', costPerUnit: '', date: new Date().toISOString().slice(0, 10) });
  const [purchasing, setPurchasing] = useState(false);

  // History item filter
  const [historyItemId, setHistoryItemId] = useState('');

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, statsRes] = await Promise.all([
        apiClient.get('/stock/items'),
        apiClient.get('/stock/stats'),
      ]);
      setItems(itemsRes.data.items ?? []);
      if (statsRes.data.stats) setStats(statsRes.data.stats);
    } catch { showToast('Failed to load stock data', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  const loadPurchases = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/stock/purchases');
      setPurchases(data.purchases ?? []);
    } catch { setPurchases([]); }
  }, []);

  const loadHistory = useCallback(async (itemId?: string) => {
    try {
      const url = itemId ? `/stock/${itemId}/history` : '/stock/history';
      const { data } = await apiClient.get(url);
      setHistory(data.history ?? []);
    } catch { setHistory([]); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (tab === 'purchases') loadPurchases(); }, [tab, loadPurchases]);
  useEffect(() => { if (tab === 'history') loadHistory(historyItemId || undefined); }, [tab, historyItemId, loadHistory]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? items.filter(i => i.name.toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q)) : items;
  }, [items, search]);

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustItem) return;
    const qty = parseFloat(adjustForm.qty);
    if (isNaN(qty) || qty <= 0) { showToast('Enter a valid quantity', 'error'); return; }
    setAdjusting(true);
    try {
      await apiClient.post('/stock/adjust', {
        itemId: adjustItem.id,
        changeType: adjustForm.type,
        quantityChange: qty,
        reason: adjustForm.reason || undefined,
        date: adjustForm.date,
      });
      setAdjustItem(null);
      showToast('Stock adjusted successfully', 'success');
      await loadAll();
    } catch (err: any) { showToast(err.response?.data?.error ?? 'Adjustment failed', 'error'); }
    finally { setAdjusting(false); }
  }

  async function handlePurchase(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(purchaseForm.qty);
    const cpu = parseFloat(purchaseForm.costPerUnit);
    if (!purchaseForm.itemId || isNaN(qty) || isNaN(cpu)) { showToast('Fill all required fields', 'error'); return; }
    setPurchasing(true);
    try {
      await apiClient.post('/stock/purchases', { ...purchaseForm, qty, costPerUnit: cpu });
      setShowPurchase(false);
      setPurchaseForm({ itemId: '', supplierName: '', qty: '', costPerUnit: '', date: new Date().toISOString().slice(0, 10) });
      showToast('Purchase recorded', 'success');
      await loadAll();
      loadPurchases();
    } catch (err: any) { showToast(err.response?.data?.error ?? 'Purchase failed', 'error'); }
    finally { setPurchasing(false); }
  }

  const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white";

  return (
    <div className="dark-app flex flex-col min-h-screen" style={{ background: 'var(--bg-app)' }}>
      <Topbar />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          <span>{toast.type === 'success' ? '✓' : '!'}</span>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">×</button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-5 py-5 xl:px-8">
        <div className="max-w-6xl mx-auto space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Stock Management</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Inventory, purchases & adjustments</p>
            </div>
            <button onClick={() => setShowPurchase(true)}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'var(--accent)' }}>
              + Record Purchase
            </button>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Total Products', value: stats.totalProducts.toString(), color: '#4361EE' },
              { label: 'Stock Value', value: INR(stats.totalStockValue), color: '#10b981' },
              { label: 'Low Stock', value: stats.lowStockCount.toString(), color: '#f59e0b' },
              { label: 'Out of Stock', value: stats.outOfStockCount.toString(), color: '#ef4444' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-4" style={{ background: '#fff', border: `1px solid ${s.color}20`, borderLeft: `4px solid ${s.color}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-tertiary)' }}>{s.label}</p>
                <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-xl p-1" style={{ background: 'rgba(0,0,0,0.05)' }}>
            {(['inventory', 'purchases', 'history'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all"
                style={tab === t ? { background: '#fff', color: 'var(--accent)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : { color: 'var(--text-secondary)' }}>
                {t === 'inventory' ? 'Inventory' : t === 'purchases' ? 'Purchases' : 'History'}
              </button>
            ))}
          </div>

          {/* ── INVENTORY TAB ── */}
          {tab === 'inventory' && (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              {/* Search */}
              <div className="p-4 border-b border-slate-100">
                <input type="text" placeholder="Search by name or SKU…" value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-100 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none transition-all" />
              </div>
              {loading ? (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: '#F7F9FC', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        {['Item Name', 'HSN/SAC', 'Unit', 'Current Stock', 'Low Stock Threshold', 'Stock Value', 'Status', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>No items found</td></tr>
                      ) : filtered.map((item, i) => {
                        const isLow = item.stockQty > 0 && item.stockQty <= item.lowStockThreshold;
                        return (
                          <tr key={item.id}
                            style={{ background: isLow ? 'rgba(245,158,11,0.04)' : undefined, borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.05)' : undefined }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F7F9FC')}
                            onMouseLeave={e => (e.currentTarget.style.background = isLow ? 'rgba(245,158,11,0.04)' : '')}>
                            <td className="px-4 py-3">
                              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                              {item.sku && <p className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{item.sku}</p>}
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{item.hsnSac || '—'}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{item.unit}</td>
                            <td className="px-4 py-3">
                              <span className={`text-sm font-black ${item.stockQty <= 0 ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {item.stockQty}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{item.lowStockThreshold}</td>
                            <td className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{INR(item.stockQty * item.price)}</td>
                            <td className="px-4 py-3"><StockBadge item={item} /></td>
                            <td className="px-4 py-3">
                              <button onClick={() => { setAdjustItem(item); setAdjustForm({ type: 'STOCK_IN', qty: '', reason: '', date: new Date().toISOString().slice(0, 10) }); }}
                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all hover:border-teal-400"
                                style={{ border: '1px solid rgba(0,0,0,0.12)', color: 'var(--text-secondary)' }}>
                                Adjust Stock
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── PURCHASES TAB ── */}
          {tab === 'purchases' && (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: '#F7F9FC', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      {['Item', 'Supplier', 'Qty', 'Cost/Unit', 'Total Cost', 'Date'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>No purchases recorded yet</td></tr>
                    ) : purchases.map((p, i) => (
                      <tr key={p.id} style={{ borderBottom: i < purchases.length - 1 ? '1px solid rgba(0,0,0,0.05)' : undefined }}>
                        <td className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{p.item.name}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{p.supplierName}</td>
                        <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{p.qty} {p.item.unit}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{INR(p.costPerUnit)}</td>
                        <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{INR(p.totalCost)}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{fmtDate(p.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <select value={historyItemId} onChange={e => setHistoryItemId(e.target.value)}
                  className="px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-teal-500 outline-none">
                  <option value="">All items</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: '#F7F9FC', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        {['Date', 'Type', 'Change', 'Previous Qty', 'New Qty', 'Reason'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>No history found</td></tr>
                      ) : history.map((h, i) => (
                        <tr key={h.id} style={{ borderBottom: i < history.length - 1 ? '1px solid rgba(0,0,0,0.05)' : undefined }}>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{fmtDt(h.date)}</td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: h.changeType === 'PURCHASE' ? 'rgba(16,185,129,0.1)' : h.changeType === 'SALE' ? 'rgba(239,68,68,0.1)' : 'rgba(67,97,238,0.1)', color: h.changeType === 'PURCHASE' ? '#10b981' : h.changeType === 'SALE' ? '#ef4444' : '#4361EE' }}>
                              {h.changeType.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold" style={{ color: h.quantityChange >= 0 ? '#10b981' : '#ef4444' }}>
                            {h.quantityChange >= 0 ? '+' : ''}{h.quantityChange}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{h.previousQty}</td>
                          <td className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{h.newQty}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{h.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── Adjust Stock Modal ── */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800">Adjust Stock</h3>
                <p className="text-xs text-slate-400 mt-0.5">{adjustItem.name} · Current: {adjustItem.stockQty} {adjustItem.unit}</p>
              </div>
              <button onClick={() => setAdjustItem(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <form onSubmit={handleAdjust} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Type</label>
                <select value={adjustForm.type} onChange={e => setAdjustForm(f => ({ ...f, type: e.target.value as AdjustType }))} className={inputCls}>
                  <option value="STOCK_IN">Stock In (Add)</option>
                  <option value="STOCK_OUT">Stock Out (Remove)</option>
                  <option value="CORRECTION">Correction (Set absolute)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Quantity</label>
                <input type="number" min="0.01" step="0.01" required value={adjustForm.qty}
                  onChange={e => setAdjustForm(f => ({ ...f, qty: e.target.value }))} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Reason</label>
                <input type="text" value={adjustForm.reason} onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))} className={inputCls} placeholder="Optional note" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Date</label>
                <input type="date" value={adjustForm.date} onChange={e => setAdjustForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAdjustItem(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={adjusting} className="px-5 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                  {adjusting ? 'Saving…' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Record Purchase Modal ── */}
      {showPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Record Purchase</h3>
              <button onClick={() => setShowPurchase(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <form onSubmit={handlePurchase} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Item <span className="text-red-500">*</span></label>
                <select required value={purchaseForm.itemId} onChange={e => setPurchaseForm(f => ({ ...f, itemId: e.target.value }))} className={inputCls}>
                  <option value="">Select item…</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Supplier Name <span className="text-red-500">*</span></label>
                <input type="text" required value={purchaseForm.supplierName} onChange={e => setPurchaseForm(f => ({ ...f, supplierName: e.target.value }))} className={inputCls} placeholder="Supplier name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Quantity <span className="text-red-500">*</span></label>
                  <input type="number" required min="1" value={purchaseForm.qty} onChange={e => setPurchaseForm(f => ({ ...f, qty: e.target.value }))} className={inputCls} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cost/Unit (₹) <span className="text-red-500">*</span></label>
                  <input type="number" required min="0" step="0.01" value={purchaseForm.costPerUnit} onChange={e => setPurchaseForm(f => ({ ...f, costPerUnit: e.target.value }))} className={inputCls} placeholder="0.00" />
                </div>
              </div>
              {purchaseForm.qty && purchaseForm.costPerUnit && (
                <p className="text-sm font-bold text-slate-700">Total: {INR(parseFloat(purchaseForm.qty || '0') * parseFloat(purchaseForm.costPerUnit || '0'))}</p>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Date</label>
                <input type="date" value={purchaseForm.date} onChange={e => setPurchaseForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPurchase(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={purchasing} className="px-5 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                  {purchasing ? 'Saving…' : 'Record Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
