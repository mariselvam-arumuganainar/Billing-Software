'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Topbar from '@/components/Topbar';
import { apiClient } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────
type Expense = {
  id: string;
  category: string;
  amount: number;
  date: string;
  notes: string | null;
  paymentMode: string | null;
  vendorName: string | null;
  referenceNumber: string | null;
  attachmentUrl: string | null;
  attachmentFileName: string | null;
  attachmentMimeType: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ExpenseForm = {
  category: string;
  amount: string;
  date: string;
  notes: string;
  paymentMode: string;
  vendorName: string;
  referenceNumber: string;
  attachmentUrl: string;
  attachmentFileName: string;
  attachmentMimeType: string;
};

type FilterState = {
  search: string;
  category: string;
  paymentMode: string;
  hasAttachment: string;
  dateFrom: string;
  dateTo: string;
};

type SortField = 'date' | 'amount' | 'category';

// ── Constants ─────────────────────────────────────────────────────────────
// Keeps legacy categories (Salary, Inventory, Logistics, Marketing) intact for existing data
const CATEGORIES = [
  'Rent', 'Salary', 'Utilities', 'Inventory', 'Logistics', 'Marketing',
  'Repairs & Maintenance', 'Bank Charges', 'Taxes & Compliance',
  'Office Supplies', 'Packaging', 'Food & Refreshments', 'Miscellaneous',
];

const PAYMENT_MODES = ['CASH', 'CARD', 'UPI', 'BANK', 'OTHER'] as const;

const EMPTY_FORM: ExpenseForm = {
  category: 'Miscellaneous',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
  paymentMode: 'CASH',
  vendorName: '',
  referenceNumber: '',
  attachmentUrl: '',
  attachmentFileName: '',
  attachmentMimeType: '',
};

// ── Colour maps ───────────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  'Rent':                  '#f43f5e',
  'Salary':                '#f97316',
  'Utilities':             '#eab308',
  'Inventory':             '#10b981',
  'Logistics':             '#3b82f6',
  'Marketing':             '#8b5cf6',
  'Repairs & Maintenance': '#06b6d4',
  'Bank Charges':          '#f59e0b',
  'Taxes & Compliance':    '#ef4444',
  'Office Supplies':       '#14b8a6',
  'Packaging':             '#6366f1',
  'Food & Refreshments':   '#ec4899',
  'Miscellaneous':         '#64748b',
};
const catColor = (cat: string) => CAT_COLOR[cat] ?? '#8b5cf6';

const MODE_COLOR: Record<string, string> = {
  CASH: '#10b981', CARD: '#3b82f6', UPI: '#8b5cf6', BANK: '#06b6d4', OTHER: '#64748b',
};

// ── Formatters ────────────────────────────────────────────────────────────
const fmtCurrency = (v: number) =>
  `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtShort = (v: number) => {
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000)   return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
};

const toDateStr  = (iso: string) => new Date(iso).toISOString().split('T')[0];
const fmtDate    = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDT      = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ── File helpers ──────────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
const isImage = (mime: string | null) => !!mime && mime.startsWith('image/');

// ── CSV export ────────────────────────────────────────────────────────────
function exportToCSV(expenses: Expense[]) {
  const headers = ['Date', 'Category', 'Amount (₹)', 'Payment Mode', 'Vendor / Paid To', 'Reference No', 'Notes', 'Attachment'];
  const rows = expenses.map(e => [
    fmtDate(e.date),
    e.category,
    e.amount.toFixed(2),
    e.paymentMode ?? '',
    e.vendorName ?? '',
    e.referenceNumber ?? '',
    (e.notes ?? '').replace(/,/g, ';'),
    e.attachmentFileName ?? '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 7-Day Trend SVG ──────────────────────────────────────────────────────
function TrendChart({ expenses }: { expenses: Expense[] }) {
  const days = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      out.push({
        label:   d.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 3),
        ds,
        total:   expenses.filter(e => toDateStr(e.date) === ds).reduce((s, e) => s + e.amount, 0),
        isToday: i === 0,
      });
    }
    return out;
  }, [expenses]);

  const maxVal = Math.max(...days.map(d => d.total), 1);
  const W = 240; const H = 72; const bW = 24; const gap = (W - 7 * bW) / 6;

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-[72px]" style={{ overflow: 'visible' }}>
      {days.map((d, i) => {
        const bH  = Math.max((d.total / maxVal) * H, d.total > 0 ? 4 : 2);
        const x   = i * (bW + gap);
        const y   = H - bH;
        const col = d.isToday ? '#f97316' : d.total > 0 ? '#8b5cf6' : 'rgba(255,255,255,0.07)';
        return (
          <g key={d.ds}>
            <rect x={x} y={y} width={bW} height={bH} rx="4" fill={col} opacity={d.total > 0 ? 0.85 : 1} />
            {d.total > 0 && (
              <text x={x + bW / 2} y={y - 4} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="7" fontWeight="600">
                {fmtShort(d.total)}
              </text>
            )}
            <text x={x + bW / 2} y={H + 14} textAnchor="middle"
              fill={d.isToday ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.30)'}
              fontSize="8" fontWeight={d.isToday ? '700' : '400'}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Category Breakdown ────────────────────────────────────────────────────
function CategoryBreakdown({ expenses }: { expenses: Expense[] }) {
  const items = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
    const grand = Object.values(totals).reduce((s, v) => s + v, 0);
    return Object.entries(totals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 7)
      .map(([cat, amt]) => ({ cat, amt, pct: grand > 0 ? (amt / grand) * 100 : 0, color: catColor(cat) }));
  }, [expenses]);

  if (items.length === 0) {
    return <p className="text-xs text-white/25 text-center py-4">No data for selected period</p>;
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.cat}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color }} />
              <span className="text-xs text-white/65 truncate">{item.cat}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] text-white/35">{item.pct.toFixed(0)}%</span>
              <span className="text-xs font-bold text-white w-16 text-right">{fmtShort(item.amt)}</span>
            </div>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, background: item.color, opacity: 0.75 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, hero = false }: {
  label: string; value: string; sub: string; color: string; hero?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 relative overflow-hidden flex flex-col gap-1.5"
      style={hero
        ? { background: `linear-gradient(135deg, ${color} 0%, ${color}bb 100%)`, boxShadow: `0 6px 24px ${color}44` }
        : { background: `${color}12`, border: `1px solid ${color}28`, boxShadow: `0 2px 12px ${color}16` }
      }
    >
      <p className="text-[10px] font-bold text-white/55 uppercase tracking-wider">{label}</p>
      <p className="text-[17px] font-black text-white leading-none tracking-tight">{value}</p>
      <p className="text-[10px] text-white/40 leading-tight">{sub}</p>
      {hero && <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-15" style={{ background: 'rgba(255,255,255,0.5)' }} />}
    </div>
  );
}

// ── Attachment chip ───────────────────────────────────────────────────────
function AttachmentChip({ fileName, onRemove }: { fileName: string; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium max-w-full"
      style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.28)', color: '#a5b4fc' }}>
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
      </svg>
      <span className="truncate">{fileName}</span>
      <button onClick={onRemove} className="text-white/40 hover:text-white ml-1 leading-none shrink-0">×</button>
    </div>
  );
}

// ── Sort button ───────────────────────────────────────────────────────────
function SortBtn({ active, dir, onClick, children }: {
  active: boolean; dir: 'asc' | 'desc'; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors"
      style={{ color: active ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.28)' }}>
      {children}
      {active && <span style={{ color: 'var(--theme-nav-dot)' }}>{dir === 'desc' ? '↓' : '↑'}</span>}
    </button>
  );
}

// ── Add / Edit drawer ─────────────────────────────────────────────────────
function ExpenseFormDrawer({ expense, onClose, onSave }: {
  expense: Expense | null;
  onClose: () => void;
  onSave: (form: ExpenseForm) => Promise<void>;
}) {
  const isEdit     = !!expense;
  const fileRef    = useRef<HTMLInputElement>(null);
  const [form,     setForm]     = useState<ExpenseForm>(
    expense
      ? {
          category:          expense.category,
          amount:            expense.amount.toString(),
          date:              toDateStr(expense.date),
          notes:             expense.notes ?? '',
          paymentMode:       expense.paymentMode ?? 'CASH',
          vendorName:        expense.vendorName ?? '',
          referenceNumber:   expense.referenceNumber ?? '',
          attachmentUrl:     expense.attachmentUrl ?? '',
          attachmentFileName: expense.attachmentFileName ?? '',
          attachmentMimeType: expense.attachmentMimeType ?? '',
        }
      : { ...EMPTY_FORM },
  );
  const [saving,    setSaving]   = useState(false);
  const [error,     setError]    = useState('');
  const [fileError, setFileError] = useState('');

  const set = (key: keyof ExpenseForm, value: string) => setForm(p => ({ ...p, [key]: value }));

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError('');
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) { setFileError('Only JPG, PNG, WEBP, or PDF files are accepted.'); return; }
    if (file.size > 2 * 1024 * 1024)  { setFileError('File must be smaller than 2 MB.'); return; }
    try {
      const b64 = await fileToBase64(file);
      setForm(p => ({ ...p, attachmentUrl: b64, attachmentFileName: file.name, attachmentMimeType: file.type }));
    } catch {
      setFileError('Could not read the file. Please try again.');
    }
  }

  function clearFile() {
    setForm(p => ({ ...p, attachmentUrl: '', attachmentFileName: '', attachmentMimeType: '' }));
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const amt = parseFloat(form.amount);
    if (!form.category)           { setError('Category is required.'); return; }
    if (!form.amount || isNaN(amt) || amt <= 0) { setError('Enter a valid amount greater than zero.'); return; }
    if (!form.date)               { setError('Date is required.'); return; }
    setSaving(true);
    try {
      await onSave(form);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const iCls  = "w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none transition-all";
  const iSt   = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' } as React.CSSProperties;
  const lbCls = "block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ml-auto h-full w-full max-w-xl flex flex-col shadow-2xl"
        style={{ background: 'var(--theme-modal-bg)', borderLeft: '1px solid rgba(255,255,255,0.09)' }}>

        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h3 className="text-base font-black text-white">{isEdit ? 'Edit Expense' : 'Log Expense'}</h3>
            <p className="text-[11px] text-white/35 mt-0.5">{isEdit ? 'Update this expense record' : 'Record a new business expense'}</p>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all text-xl leading-none">
            ×
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-6 space-y-5 flex-1">

            {error && (
              <div className="p-3 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.24)', color: '#fb7185' }}>
                {error}
              </div>
            )}

            {/* Date + Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbCls}>Expense Date *</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                  className={iCls} style={iSt} required />
              </div>
              <div>
                <label className={lbCls}>Category *</label>
                <select value={form.category} onChange={e => set('category', e.target.value)}
                  className={iCls} style={iSt} required>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Amount + Payment Mode */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbCls}>Amount (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35 font-bold text-sm pointer-events-none">₹</span>
                  <input type="number" step="0.01" min="0.01" value={form.amount}
                    onChange={e => set('amount', e.target.value)}
                    className={`${iCls} pl-7`} style={iSt} placeholder="0.00" required />
                </div>
              </div>
              <div>
                <label className={lbCls}>Payment Mode</label>
                <select value={form.paymentMode} onChange={e => set('paymentMode', e.target.value)}
                  className={iCls} style={iSt}>
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Vendor + Reference */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbCls}>Vendor / Paid To</label>
                <input type="text" value={form.vendorName} maxLength={100}
                  onChange={e => set('vendorName', e.target.value)}
                  className={iCls} style={iSt} placeholder="e.g. City Electricity Board" />
              </div>
              <div>
                <label className={lbCls}>Reference / Bill No.</label>
                <input type="text" value={form.referenceNumber} maxLength={80}
                  onChange={e => set('referenceNumber', e.target.value)}
                  className={iCls} style={iSt} placeholder="e.g. BILL-2024-001" />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={lbCls}>Description / Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} maxLength={500}
                className={iCls} style={{ ...iSt, resize: 'none' }}
                placeholder="Brief description of this expense…" />
            </div>

            {/* Attachment */}
            <div>
              <label className={lbCls}>Bill / Receipt Attachment</label>
              {form.attachmentFileName ? (
                <AttachmentChip fileName={form.attachmentFileName} onRemove={clearFile} />
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full py-3.5 rounded-xl text-xs font-semibold text-white/45 hover:text-white/70 transition-all flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.14)' }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                  </svg>
                  Upload Receipt / Bill — JPG, PNG, PDF (max 2 MB)
                </button>
              )}
              {fileError && <p className="mt-1.5 text-[11px]" style={{ color: '#fb7185' }}>{fileError}</p>}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange} className="hidden" />
              <p className="mt-1.5 text-[10px] text-white/20">Stored per tenant. Used for audit, reimbursement, or GST reconciliation.</p>
            </div>

            {/* Future-ready placeholder strip */}
            <div className="rounded-xl px-4 py-3 flex items-center gap-5"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[9px] font-bold text-white/18 uppercase tracking-widest shrink-0">Coming soon</p>
              {['🏷 Tags', '🔄 Recurring', '✅ Approval', '🧾 GST Credit'].map(f => (
                <span key={f} className="text-[10px] text-white/18">{f}</span>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 flex justify-end gap-3 shrink-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.18)' }}>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white hover:bg-white/08 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 bg-violet-600 hover:bg-violet-500">
              {saving ? 'Saving…' : isEdit ? 'Update Expense' : 'Log Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────
function DetailModal({ expense, onClose, onEdit, onArchive }: {
  expense: Expense;
  onClose:   () => void;
  onEdit:    () => void;
  onArchive: () => void;
}) {
  const color     = catColor(expense.category);
  const modeColor = expense.paymentMode ? (MODE_COLOR[expense.paymentMode] ?? '#64748b') : null;

  function download() {
    if (!expense.attachmentUrl) return;
    const a = document.createElement('a');
    a.href     = expense.attachmentUrl;
    a.download = expense.attachmentFileName ?? 'attachment';
    a.click();
  }

  const infoTile = (label: string, value: string, valueColor?: string) => (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[9px] font-bold text-white/28 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-semibold" style={{ color: valueColor ?? 'rgba(255,255,255,0.80)' }}>{value || '—'}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--theme-modal-bg)', border: '1px solid rgba(255,255,255,0.10)' }}>

        {/* Header */}
        <div className="px-6 py-4 flex items-start justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              <span className="text-xs font-bold" style={{ color }}>{expense.category}</span>
            </div>
            <p className="text-2xl font-black text-white">{fmtCurrency(expense.amount)}</p>
            <p className="text-xs text-white/40 mt-0.5">{fmtDate(expense.date)}</p>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {infoTile('Payment Mode',       expense.paymentMode ?? '',    modeColor ?? undefined)}
            {infoTile('Vendor / Paid To',   expense.vendorName ?? '')}
            {infoTile('Reference No.',      expense.referenceNumber ?? '')}
            {infoTile('Status',             expense.status, expense.status === 'ACTIVE' ? '#34d399' : '#fb7185')}
          </div>

          {expense.notes && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[9px] font-bold text-white/28 uppercase tracking-wider mb-1.5">Notes</p>
              <p className="text-sm text-white/70 leading-relaxed">{expense.notes}</p>
            </div>
          )}

          {/* Attachment */}
          {expense.attachmentUrl && (
            <div className="rounded-xl p-4 space-y-3"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[9px] font-bold text-white/28 uppercase tracking-wider">Attachment</p>
              {isImage(expense.attachmentMimeType) && (
                <img src={expense.attachmentUrl} alt="Receipt"
                  className="max-h-44 rounded-lg object-contain w-full"
                  style={{ background: 'rgba(255,255,255,0.05)' }} />
              )}
              <button onClick={download}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(99,102,241,0.14)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.24)' }}>
                ⬇ {expense.attachmentMimeType === 'application/pdf' ? 'Download PDF' : 'Download Image'}
                {expense.attachmentFileName && ` — ${expense.attachmentFileName}`}
              </button>
            </div>
          )}

          {/* Audit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[9px] font-bold text-white/20 uppercase tracking-wider mb-1">Created At</p>
              <p className="text-[11px] text-white/40">{fmtDT(expense.createdAt)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[9px] font-bold text-white/20 uppercase tracking-wider mb-1">Last Updated</p>
              <p className="text-[11px] text-white/40">{fmtDT(expense.updatedAt)}</p>
            </div>
          </div>

          {/* Future: created-by placeholder */}
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="h-6 w-6 rounded-full flex items-center justify-center font-black text-[10px]"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.25)' }}>?</div>
            <span className="text-[10px] text-white/18">Created by · multi-user tracking coming in a future release</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex items-center gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.18)' }}>
          <button onClick={onArchive}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={{ background: 'rgba(244,63,94,0.11)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.20)' }}>
            Archive
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-white/45 hover:text-white transition-colors">Close</button>
          <button onClick={onEdit}
            className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all bg-violet-600 hover:bg-violet-500">
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Archive confirm ───────────────────────────────────────────────────────
function ArchiveModal({ expense, loading, onClose, onConfirm }: {
  expense: Expense; loading: boolean; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--theme-modal-bg)', border: '1px solid rgba(255,255,255,0.10)' }}>
        <div className="p-6 text-center space-y-4">
          <div className="h-12 w-12 rounded-full mx-auto flex items-center justify-center text-xl"
            style={{ background: 'rgba(244,63,94,0.12)' }}>🗂</div>
          <div>
            <h3 className="text-base font-black text-white">Archive this expense?</h3>
            <p className="text-xs text-white/40 mt-2 leading-relaxed">
              <span className="font-bold text-white/65">{fmtCurrency(expense.amount)}</span> under{' '}
              <span className="font-bold text-white/65">{expense.category}</span> will be archived.
              It won't appear in active reports but is preserved for audit purposes.
            </p>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white hover:bg-white/08 transition-all">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}>
              {loading ? 'Archiving…' : 'Archive'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function ExpensesPage() {
  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [loading,    setLoading]    = useState(true);

  const [filters, setFilters] = useState<FilterState>({
    search: '', category: '', paymentMode: '', hasAttachment: '', dateFrom: '', dateTo: '',
  });
  const [sort, setSort] = useState<{ field: SortField; dir: 'asc' | 'desc' }>({ field: 'date', dir: 'desc' });

  // Modal/drawer state
  const [drawer,  setDrawer]  = useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null });
  const [detail,  setDetail]  = useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null });
  const [archive, setArchive] = useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null });
  const [archiving, setArchiving] = useState(false);

  // Toast
  const [toast,     setToast]   = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function showToast(msg: string, type: 'success' | 'error') {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ msg, type });
    toastRef.current = setTimeout(() => setToast(null), 3500);
  }

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/expenses');
      setExpenses(res.data.expenses ?? []);
    } catch {
      showToast('Failed to load expenses', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  // ── Derived state ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = expenses.filter(e => {
      if (filters.category     && e.category      !== filters.category)      return false;
      if (filters.paymentMode  && e.paymentMode   !== filters.paymentMode)   return false;
      if (filters.hasAttachment === 'yes' && !e.attachmentUrl)               return false;
      if (filters.hasAttachment === 'no'  &&  e.attachmentUrl)               return false;
      if (filters.dateFrom && toDateStr(e.date) < filters.dateFrom)          return false;
      if (filters.dateTo   && toDateStr(e.date) > filters.dateTo)            return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hit = [e.notes, e.vendorName, e.referenceNumber, e.category]
          .some(f => f?.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sort.field === 'date')     cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sort.field === 'amount')   cmp = a.amount - b.amount;
      else if (sort.field === 'category') cmp = a.category.localeCompare(b.category);
      return sort.dir === 'desc' ? -cmp : cmp;
    });
  }, [expenses, filters, sort]);

  const kpis = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const monthStr = new Date().toISOString().substring(0, 7);

    const total      = filtered.reduce((s, e) => s + e.amount, 0);
    const todayTotal = expenses.filter(e => toDateStr(e.date) === todayStr).reduce((s, e) => s + e.amount, 0);
    const monthTotal = expenses.filter(e => toDateStr(e.date).startsWith(monthStr)).reduce((s, e) => s + e.amount, 0);

    const uniqueDays = new Set(filtered.map(e => toDateStr(e.date))).size;
    const avgDaily   = uniqueDays > 0 ? total / uniqueDays : 0;

    const catTotals: Record<string, number> = {};
    filtered.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
    const topCat = Object.entries(catTotals).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '—';

    return { total, todayTotal, monthTotal, avgDaily, topCat, count: filtered.length };
  }, [expenses, filtered]);

  const hasFilters = Object.values(filters).some(v => v !== '');

  function setFilter(key: keyof FilterState, value: string) {
    setFilters(p => ({ ...p, [key]: value }));
  }
  function clearFilters() {
    setFilters({ search: '', category: '', paymentMode: '', hasAttachment: '', dateFrom: '', dateTo: '' });
  }
  function toggleSort(field: SortField) {
    setSort(p => p.field === field ? { field, dir: p.dir === 'desc' ? 'asc' : 'desc' } : { field, dir: 'desc' });
  }

  // ── Save (create / update) ─────────────────────────────────────────────
  async function handleSave(form: ExpenseForm) {
    const payload = {
      category:          form.category,
      amount:            parseFloat(form.amount),
      date:              form.date,
      notes:             form.notes       || null,
      paymentMode:       form.paymentMode || null,
      vendorName:        form.vendorName  || null,
      referenceNumber:   form.referenceNumber || null,
      attachmentUrl:     form.attachmentUrl   || null,
      attachmentFileName:  form.attachmentFileName  || null,
      attachmentMimeType:  form.attachmentMimeType  || null,
    };
    if (drawer.expense) {
      await apiClient.put(`/expenses/${drawer.expense.id}`, payload);
      showToast('Expense updated', 'success');
    } else {
      await apiClient.post('/expenses', payload);
      showToast('Expense logged', 'success');
    }
    setDrawer({ open: false, expense: null });
    fetchExpenses();
  }

  // ── Archive ────────────────────────────────────────────────────────────
  async function handleArchive() {
    if (!archive.expense) return;
    setArchiving(true);
    try {
      await apiClient.delete(`/expenses/${archive.expense.id}`);
      setArchive({ open: false, expense: null });
      setDetail({ open: false, expense: null });
      showToast('Expense archived', 'success');
      fetchExpenses();
    } catch {
      showToast('Failed to archive expense', 'error');
    } finally {
      setArchiving(false);
    }
  }

  // ── Shared input style ────────────────────────────────────────────────
  const filterInputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' };
  const filterCls = "px-3 py-2 rounded-xl text-xs text-white/70 outline-none";

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="dark-app flex flex-col min-h-screen">
      <Topbar />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl flex items-center gap-2"
          style={{
            background: toast.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(244,63,94,0.95)',
            color: '#fff', backdropFilter: 'blur(12px)',
          }}>
          {toast.type === 'success' ? '✓' : '⚠'} {toast.msg}
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-5 py-5 xl:px-8 xl:py-6">
        <div className="max-w-[1400px] mx-auto space-y-5">

          {/* ── Header ── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Expense Ledger</h1>
              <p className="text-white/40 text-xs mt-0.5">Track operational costs, vendor bills, and business payments</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={fetchExpenses}
                className="h-9 px-3 rounded-xl text-xs font-semibold text-white/50 hover:text-white transition-all flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M1 4v6h6M23 20v-6h-6"/>
                  <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/>
                </svg>
                Refresh
              </button>
              <button onClick={() => exportToCSV(filtered)} disabled={filtered.length === 0}
                className="h-9 px-3 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)' }}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export CSV
              </button>
              <button onClick={() => setDrawer({ open: true, expense: null })}
                className="h-9 px-4 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all active:scale-95 bg-violet-600 hover:bg-violet-500">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Log Expense
              </button>
            </div>
          </div>

          {/* ── Filters ── */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex flex-wrap gap-3 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" placeholder="Search vendor, notes, ref…"
                  value={filters.search} onChange={e => setFilter('search', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-xs text-white/80 outline-none placeholder:text-white/22"
                  style={filterInputSt} />
              </div>

              {/* Date range */}
              <input type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)}
                className={filterCls} style={filterInputSt} />
              <span className="text-white/25 text-xs">→</span>
              <input type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)}
                className={filterCls} style={filterInputSt} />

              {/* Category */}
              <select value={filters.category} onChange={e => setFilter('category', e.target.value)}
                className={filterCls} style={filterInputSt}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* Payment mode */}
              <select value={filters.paymentMode} onChange={e => setFilter('paymentMode', e.target.value)}
                className={filterCls} style={filterInputSt}>
                <option value="">All Modes</option>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              {/* Attachment */}
              <select value={filters.hasAttachment} onChange={e => setFilter('hasAttachment', e.target.value)}
                className={filterCls} style={filterInputSt}>
                <option value="">Any Attachment</option>
                <option value="yes">Has Receipt</option>
                <option value="no">No Receipt</option>
              </select>

              {hasFilters && (
                <button onClick={clearFilters}
                  className="text-xs font-bold px-3 py-2 rounded-xl transition-all"
                  style={{ background: 'rgba(244,63,94,0.11)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.20)' }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ── KPI cards ── */}
          <section className="grid grid-cols-2 xl:grid-cols-6 gap-3">
            <KpiCard label="Total (Filtered)"  value={fmtShort(kpis.total)}      sub={`${kpis.count} entries`}           color="#8b5cf6" hero />
            <KpiCard label="Today"             value={fmtShort(kpis.todayTotal)} sub="All of today"                      color="#f97316" />
            <KpiCard label="This Month"        value={fmtShort(kpis.monthTotal)} sub="Current calendar month"             color="#f43f5e" />
            <KpiCard label="Avg Daily"         value={fmtShort(kpis.avgDaily)}   sub="Per active day (filtered)"          color="#3b82f6" />
            <KpiCard label="Top Category"      value={kpis.topCat}               sub="Highest spending"                   color="#10b981" />
            <KpiCard label="Entries"           value={`${kpis.count}`}           sub={`of ${expenses.length} total`}      color="#6366f1" />
          </section>

          {/* ── Analytics row ── */}
          <section className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5">

            {/* Category breakdown */}
            <div className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Category Breakdown</h3>
                  <p className="text-[11px] text-white/40 mt-0.5">Spending distribution across expense types</p>
                </div>
                <span className="text-xs font-black text-white/60">{fmtCurrency(kpis.total)}</span>
              </div>
              <CategoryBreakdown expenses={filtered} />
            </div>

            {/* 7-day trend + largest */}
            <div className="rounded-2xl p-5 flex flex-col"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="mb-3">
                <h3 className="text-sm font-bold text-white">7-Day Trend</h3>
                <p className="text-[11px] text-white/40 mt-0.5">Daily spend — last 7 days</p>
              </div>
              <TrendChart expenses={expenses} />

              {filtered.length > 0 && (
                <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[9px] font-bold text-white/28 uppercase tracking-wider mb-2">Largest Entries</p>
                  {[...filtered].sort((a, b) => b.amount - a.amount).slice(0, 3).map(e => (
                    <div key={e.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: catColor(e.category) }} />
                        <span className="text-[10px] text-white/50 truncate">{e.vendorName || e.category}</span>
                      </div>
                      <span className="text-[10px] font-bold text-white/75 shrink-0 ml-2">{fmtShort(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── Ledger table ── */}
          <section className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>

            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h3 className="text-sm font-bold text-white">Expense Records</h3>
                <p className="text-[11px] text-white/35 mt-0.5">
                  {loading ? 'Loading…' : `${filtered.length} of ${expenses.length} entries`}
                  {hasFilters && !loading && ' — filtered'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {[
                      { label: 'Date',   field: 'date'     as SortField },
                      { label: 'Category', field: 'category' as SortField },
                    ].map(col => (
                      <th key={col.field} className="px-4 py-2.5 text-left">
                        <SortBtn active={sort.field === col.field} dir={sort.dir} onClick={() => toggleSort(col.field)}>
                          {col.label}
                        </SortBtn>
                      </th>
                    ))}
                    {['Vendor / Notes', 'Mode', 'Reference', '📎'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/25">{h}</span>
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-right">
                      <SortBtn active={sort.field === 'amount'} dir={sort.dir} onClick={() => toggleSort('amount')}>Amount</SortBtn>
                    </th>
                    <th className="px-4 py-2.5 text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/25">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Loading skeleton */}
                  {loading && Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-3 rounded animate-pulse"
                            style={{ background: 'rgba(255,255,255,0.06)', width: j === 7 ? '72px' : '80%' }} />
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* Empty state */}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-3xl"
                            style={{ background: 'rgba(255,255,255,0.05)' }}>
                            {hasFilters ? '🔍' : '📋'}
                          </div>
                          <p className="text-sm font-semibold text-white/40">
                            {hasFilters ? 'No expenses match your filters' : 'No expenses logged yet'}
                          </p>
                          <p className="text-xs text-white/25">
                            {hasFilters
                              ? 'Try clearing or adjusting the filters above'
                              : 'Click "Log Expense" to record your first business expense'}
                          </p>
                          {hasFilters && (
                            <button onClick={clearFilters}
                              className="text-xs font-bold px-4 py-1.5 rounded-lg mt-1 transition-all"
                              style={{ background: 'rgba(139,92,246,0.12)', color: '#a5b4fc', border: '1px solid rgba(139,92,246,0.22)' }}>
                              Clear Filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Data rows */}
                  {!loading && filtered.map((e, i) => {
                    const color     = catColor(e.category);
                    const modeColor = e.paymentMode ? (MODE_COLOR[e.paymentMode] ?? '#64748b') : null;
                    return (
                      <tr key={e.id} className="group cursor-pointer"
                        style={i < filtered.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.04)' } : undefined}
                        onClick={() => setDetail({ open: true, expense: e })}
                        onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                        onMouseLeave={ev => (ev.currentTarget.style.background = '')}>

                        {/* Date */}
                        <td className="px-4 py-3.5">
                          <p className="text-xs font-semibold text-white/70">{fmtDate(e.date)}</p>
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: `${color}18`, color, border: `1px solid ${color}28` }}>
                            {e.category}
                          </span>
                        </td>

                        {/* Vendor / Notes */}
                        <td className="px-4 py-3.5 max-w-[180px]">
                          {e.vendorName && <p className="text-xs font-semibold text-white/65 truncate">{e.vendorName}</p>}
                          {e.notes && <p className="text-[10px] text-white/32 truncate mt-0.5">{e.notes}</p>}
                          {!e.vendorName && !e.notes && <span className="text-[10px] text-white/18">—</span>}
                        </td>

                        {/* Mode */}
                        <td className="px-4 py-3.5">
                          {modeColor
                            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                                style={{ background: `${modeColor}16`, color: modeColor }}>{e.paymentMode}</span>
                            : <span className="text-[10px] text-white/18">—</span>}
                        </td>

                        {/* Reference */}
                        <td className="px-4 py-3.5">
                          <span className="text-[10px] font-mono text-white/40">{e.referenceNumber || '—'}</span>
                        </td>

                        {/* Attachment */}
                        <td className="px-4 py-3.5 text-center">
                          {e.attachmentUrl
                            ? <span title={e.attachmentFileName ?? 'Attachment'}>📎</span>
                            : <span className="text-white/14 text-xs">—</span>}
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-sm font-black text-white">{fmtCurrency(e.amount)}</span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right" onClick={ev => ev.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setDetail({ open: true, expense: e })}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                              style={{ color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.07)' }}>
                              View
                            </button>
                            <button
                              onClick={() => setDrawer({ open: true, expense: e })}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                              style={{ color: '#a5b4fc', background: 'rgba(99,102,241,0.13)' }}>
                              Edit
                            </button>
                            <button
                              onClick={() => setArchive({ open: true, expense: e })}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                              style={{ color: '#fb7185', background: 'rgba(244,63,94,0.10)' }}>
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            {!loading && filtered.length > 0 && (
              <div className="px-5 py-3 flex items-center justify-between"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] text-white/28">
                  {filtered.length} entries · {fmtCurrency(kpis.total)} total
                </p>
                <p className="text-[10px] text-white/20">
                  Sorted by {sort.field} {sort.dir === 'desc' ? '(newest first)' : '(oldest first)'}
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ── Modals / Drawer ── */}
      {drawer.open && (
        <ExpenseFormDrawer
          expense={drawer.expense}
          onClose={() => setDrawer({ open: false, expense: null })}
          onSave={handleSave}
        />
      )}

      {detail.open && detail.expense && (
        <DetailModal
          expense={detail.expense}
          onClose={() => setDetail({ open: false, expense: null })}
          onEdit={() => {
            setDrawer({ open: true, expense: detail.expense });
            setDetail({ open: false, expense: null });
          }}
          onArchive={() => {
            setArchive({ open: true, expense: detail.expense });
            setDetail({ open: false, expense: null });
          }}
        />
      )}

      {archive.open && archive.expense && (
        <ArchiveModal
          expense={archive.expense}
          loading={archiving}
          onClose={() => setArchive({ open: false, expense: null })}
          onConfirm={handleArchive}
        />
      )}
    </div>
  );
}
