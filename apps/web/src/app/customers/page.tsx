'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Topbar from '@/components/Topbar';
import { apiClient } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────
type CreditAccount = { id: string; creditLimit: number; currentDue: number };
type Customer = {
  id: string;
  name: string | null;
  mobileNumber: string;
  totalRewardPoints: number;
  creditAccount?: CreditAccount | null;
};
type Invoice = {
  id: string;
  invoiceSequence: string;
  customerId: string | null;
  grandTotal: number;
  paymentMode: string;
  rewardPointsEarned: number;
  status: string;
  createdAt: string;
};
type ToastEntry = { id: number; message: string; type: 'success' | 'error' };
type Risk = 'none' | 'moderate' | 'high' | 'critical';

// ── Constants & helpers ────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-teal-500', 'bg-indigo-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-sky-500', 'bg-emerald-500', 'bg-orange-500',
];
const BAR_COLOR: Record<Risk, string> = {
  none: 'bg-teal-500', moderate: 'bg-amber-400', high: 'bg-orange-500', critical: 'bg-red-500',
};
const RISK_CFG: Record<Risk, { cls: string; label: string }> = {
  none:     { cls: '', label: '' },
  moderate: { cls: 'bg-amber-50 text-amber-700 border border-amber-200', label: 'Moderate Risk' },
  high:     { cls: 'bg-orange-50 text-orange-700 border border-orange-200', label: 'High Risk' },
  critical: { cls: 'bg-red-50 text-red-700 border border-red-200', label: 'Critical' },
};
const MOBILE_RE = /^[6-9]\d{9}$/;

function avatarColor(name: string | null) {
  return AVATAR_COLORS[(name ?? 'A').charCodeAt(0) % AVATAR_COLORS.length];
}
function initial(name: string | null) { return (name ?? 'A')[0].toUpperCase(); }
function utilPct(acc?: CreditAccount | null) {
  return !acc || acc.creditLimit <= 0 ? 0 : Math.min(100, (acc.currentDue / acc.creditLimit) * 100);
}
function riskOf(pct: number): Risk {
  return pct >= 90 ? 'critical' : pct >= 70 ? 'high' : pct >= 40 ? 'moderate' : 'none';
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

let _tid = 0;

// ── Sub-components ─────────────────────────────────────────────────────────
function Avatar({ name, size = 'sm' }: { name: string | null; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} ${avatarColor(name)} rounded-full flex items-center justify-center text-white font-bold shrink-0`}>
      {initial(name)}
    </div>
  );
}

function RiskBadge({ pct }: { pct: number }) {
  const risk = riskOf(pct);
  if (risk === 'none') return null;
  const { cls, label } = RISK_CFG[risk];
  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cls}`}>{label}</span>;
}

function ListSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-slate-100">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 flex items-center gap-4">
        <div className="w-14 h-14 bg-slate-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-slate-200 rounded w-1/3" />
          <div className="h-3.5 bg-slate-200 rounded w-1/4" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
            <div className="h-3 bg-slate-200 rounded w-1/2" />
            <div className="h-7 bg-slate-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const [showReg, setShowReg] = useState(false);
  const [regForm, setRegForm] = useState({ name: '', mobileNumber: '', creditLimit: '5000' });
  const [regErrors, setRegErrors] = useState({ name: '', mobileNumber: '', creditLimit: '' });
  const [savingReg, setSavingReg] = useState(false);

  const [showRepay, setShowRepay] = useState(false);
  const [repayAmt, setRepayAmt] = useState('');
  const [repayError, setRepayError] = useState('');
  const [savingRepay, setSavingRepay] = useState(false);

  // ── Toasts ────────────────────────────────────────────────────────────
  const toast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++_tid;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ── Data loaders ──────────────────────────────────────────────────────
  const loadCustomers = useCallback(async (keepId?: string) => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/customers');
      const list: Customer[] = data.customers ?? [];
      setCustomers(list);
      if (list.length > 0) {
        const target = keepId ? list.find(c => c.id === keepId) : null;
        setSelectedCust(target ?? list[0]);
      } else {
        setSelectedCust(null);
      }
    } catch {
      toast('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadInvoices = useCallback(async () => {
    try {
      setInvoicesLoading(true);
      const { data } = await apiClient.get('/reports/invoices');
      setInvoices(data.invoices ?? []);
    } catch {
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
    loadInvoices();
  }, [loadCustomers, loadInvoices]);

  // ── Derived state ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q
      ? customers.filter(c => c.name?.toLowerCase().includes(q) || c.mobileNumber.includes(q))
      : customers;
  }, [customers, search]);

  const history = useMemo(() =>
    selectedCust
      ? invoices
          .filter(i => i.customerId === selectedCust.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      : [],
    [invoices, selectedCust]);

  const util = useMemo(() => utilPct(selectedCust?.creditAccount), [selectedCust]);
  const risk = useMemo(() => riskOf(util), [util]);
  const available = useMemo(() => {
    const acc = selectedCust?.creditAccount;
    return acc ? Math.max(0, acc.creditLimit - acc.currentDue) : 0;
  }, [selectedCust]);

  // ── Handlers ──────────────────────────────────────────────────────────
  function validateReg() {
    const e = { name: '', mobileNumber: '', creditLimit: '' };
    if (!regForm.name.trim()) e.name = 'Customer name is required';
    if (!MOBILE_RE.test(regForm.mobileNumber)) e.mobileNumber = 'Enter a valid 10-digit mobile starting with 6–9';
    const lim = parseFloat(regForm.creditLimit);
    if (isNaN(lim) || lim < 0) e.creditLimit = 'Enter a valid credit limit';
    setRegErrors(e);
    return !e.name && !e.mobileNumber && !e.creditLimit;
  }

  async function handleRegister(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validateReg()) return;
    setSavingReg(true);
    try {
      const { data } = await apiClient.post('/customers', {
        name: regForm.name.trim(),
        mobileNumber: regForm.mobileNumber,
        creditLimit: parseFloat(regForm.creditLimit) || 5000,
      });
      const created: Customer = data.customer;
      setShowReg(false);
      setRegForm({ name: '', mobileNumber: '', creditLimit: '5000' });
      setRegErrors({ name: '', mobileNumber: '', creditLimit: '' });
      await loadCustomers(created.id);
      loadInvoices();
      toast(`"${created.name || created.mobileNumber}" registered`, 'success');
    } catch (err: any) {
      toast(err.response?.data?.error ?? 'Registration failed', 'error');
    } finally {
      setSavingReg(false);
    }
  }

  async function handleRepay(ev: React.FormEvent) {
    ev.preventDefault();
    if (!selectedCust?.creditAccount) return;
    const amount = parseFloat(repayAmt);
    const due = selectedCust.creditAccount.currentDue;
    if (isNaN(amount) || amount <= 0) { setRepayError('Enter a valid amount greater than zero'); return; }
    if (amount > due + 0.001) { setRepayError(`Amount cannot exceed ₹${due.toFixed(2)}`); return; }
    setSavingRepay(true);
    try {
      await apiClient.post('/credit/repay', { customerId: selectedCust.id, amount });
      setShowRepay(false);
      setRepayAmt('');
      setRepayError('');
      await loadCustomers(selectedCust.id);
      toast(`Repayment of ₹${amount.toFixed(2)} recorded`, 'success');
    } catch (err: any) {
      setRepayError(err.response?.data?.error ?? 'Repayment failed');
    } finally {
      setSavingRepay(false);
    }
  }

  function quickFill(fraction: number) {
    const due = selectedCust?.creditAccount?.currentDue ?? 0;
    setRepayAmt((due * fraction).toFixed(2));
    setRepayError('');
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="dark-app flex flex-col min-h-screen">
      <Topbar />

      {/* Toast container */}
      <div className="fixed top-4 right-4 z-100 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto
              ${t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            <span>{t.type === 'success' ? '✓' : '⚠'}</span>
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="opacity-70 hover:opacity-100 ml-1"
            >×</button>
          </div>
        ))}
      </div>

      <main className="flex-1 flex overflow-hidden">

        {/* ── Left Panel: List ── */}
        <div className="w-5/12 flex flex-col bg-white border-r border-slate-200">

          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Customers</h2>
              {!loading && <p className="text-xs text-slate-400">{customers.length} registered</p>}
            </div>
            <button
              onClick={() => {
                setRegForm({ name: '', mobileNumber: '', creditLimit: '5000' });
                setRegErrors({ name: '', mobileNumber: '', creditLimit: '' });
                setShowReg(true);
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-3 py-2 rounded-lg font-bold transition-all active:scale-95"
            >
              + Register
            </button>
          </div>

          <div className="p-3 shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or mobile..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-3 py-2 bg-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm outline-none transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <ListSkeleton />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-slate-400">
                <p className="text-sm font-medium">
                  {search ? 'No results for your search' : 'No customers yet'}
                </p>
                {!search && <p className="text-xs">Click + Register to add a customer</p>}
              </div>
            ) : (
              filtered.map(c => {
                const pct = utilPct(c.creditAccount);
                const isSelected = selectedCust?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCust(c)}
                    className={`p-4 cursor-pointer transition-colors flex items-center gap-3
                      ${isSelected
                        ? 'bg-teal-50 border-l-4 border-teal-500'
                        : 'hover:bg-slate-50 border-l-4 border-transparent'}`}
                  >
                    <Avatar name={c.name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-800 text-sm truncate">
                          {c.name || 'Anonymous'}
                        </span>
                        <RiskBadge pct={pct} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{c.mobileNumber}</p>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {c.totalRewardPoints > 0 && (
                          <span className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                            {c.totalRewardPoints} pts
                          </span>
                        )}
                        {c.creditAccount && c.creditAccount.currentDue > 0 && (
                          <span className="bg-red-50 text-red-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                            Due ₹{c.creditAccount.currentDue.toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Panel: Detail ── */}
        <div className="w-7/12 flex flex-col bg-slate-50 overflow-y-auto">
          {loading ? (
            <DetailSkeleton />
          ) : !selectedCust ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <p className="text-sm font-medium">Select a customer to view details</p>
            </div>
          ) : (
            <div className="p-6 space-y-5">

              {/* Header card */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <Avatar name={selectedCust.name} size="lg" />
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-slate-800 truncate">
                      {selectedCust.name || 'Anonymous Customer'}
                    </h3>
                    <p className="text-slate-500 text-sm mt-0.5">{selectedCust.mobileNumber}</p>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <span className="bg-teal-50 text-teal-700 text-xs px-2.5 py-0.5 rounded-full border border-teal-200 font-semibold">
                        Active
                      </span>
                      {risk !== 'none' && <RiskBadge pct={util} />}
                    </div>
                  </div>
                </div>
                {selectedCust.creditAccount && selectedCust.creditAccount.currentDue > 0 && (
                  <button
                    onClick={() => { setRepayAmt(''); setRepayError(''); setShowRepay(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-sm shrink-0"
                  >
                    Record Repayment
                  </button>
                )}
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Reward Points</p>
                  <p className="text-3xl font-black text-emerald-600">
                    {selectedCust.totalRewardPoints.toFixed(0)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    ≈ ₹{selectedCust.totalRewardPoints.toFixed(2)} value
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Outstanding Due</p>
                  {selectedCust.creditAccount ? (
                    <>
                      <p className={`text-3xl font-black ${selectedCust.creditAccount.currentDue > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        ₹{selectedCust.creditAccount.currentDue.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {selectedCust.creditAccount.currentDue > 0 ? 'Pending clearance' : 'All clear'}
                      </p>
                    </>
                  ) : (
                    <p className="text-slate-400 text-sm mt-2">No credit account</p>
                  )}
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Credit Limit</p>
                  {selectedCust.creditAccount ? (
                    <>
                      <p className="text-3xl font-black text-slate-800">
                        ₹{selectedCust.creditAccount.creditLimit.toFixed(0)}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Assigned limit</p>
                    </>
                  ) : (
                    <p className="text-slate-400 text-sm mt-2">N/A</p>
                  )}
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Available Credit</p>
                  {selectedCust.creditAccount ? (
                    <>
                      <p className={`text-3xl font-black ${available > 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                        ₹{available.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Remaining from limit</p>
                    </>
                  ) : (
                    <p className="text-slate-400 text-sm mt-2">N/A</p>
                  )}
                </div>
              </div>

              {/* Credit utilization bar */}
              {selectedCust.creditAccount && selectedCust.creditAccount.creditLimit > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Credit Utilization
                    </p>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      risk === 'none'     ? 'bg-teal-50 text-teal-700'     :
                      risk === 'moderate' ? 'bg-amber-50 text-amber-700'   :
                      risk === 'high'     ? 'bg-orange-50 text-orange-700' :
                                           'bg-red-50 text-red-700'
                    }`}>{util.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${BAR_COLOR[risk]}`}
                      style={{ width: `${util}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                    <span>₹{selectedCust.creditAccount.currentDue.toFixed(0)} used</span>
                    <span>₹{selectedCust.creditAccount.creditLimit.toFixed(0)} limit</span>
                  </div>
                </div>
              )}

              {/* Purchase history */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-700">Purchase History</p>
                  <span className="text-xs text-slate-400">{history.length} invoices</span>
                </div>
                {invoicesLoading ? (
                  <div className="p-5 space-y-3 animate-pulse">
                    {[0, 1, 2].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg" />)}
                  </div>
                ) : history.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">No purchases recorded yet</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="text-left px-5 py-3">Invoice</th>
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-left px-4 py-3">Mode</th>
                        <th className="text-right px-5 py-3">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.slice(0, 20).map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 font-mono text-xs text-slate-600">{inv.invoiceSequence}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(inv.createdAt)}</td>
                          <td className="px-4 py-3">
                            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-medium">
                              {inv.paymentMode}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-slate-800">
                            ₹{inv.grandTotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Notes placeholder */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-700">Notes</p>
                </div>
                <div className="p-5 text-sm text-slate-400 italic">Customer notes coming soon...</div>
              </div>

            </div>
          )}
        </div>
      </main>

      {/* ── Register Modal ── */}
      {showReg && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Register Customer</h3>
              <button onClick={() => setShowReg(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
                ×
              </button>
            </div>
            <form onSubmit={handleRegister} noValidate className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={regForm.name}
                  onChange={e => {
                    setRegForm(p => ({ ...p, name: e.target.value }));
                    setRegErrors(p => ({ ...p, name: '' }));
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm
                    ${regErrors.name ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                  placeholder="John Doe"
                />
                {regErrors.name && <p className="text-xs text-red-600 mt-1">{regErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={regForm.mobileNumber}
                  onChange={e => {
                    setRegForm(p => ({ ...p, mobileNumber: e.target.value.replace(/\D/g, '') }));
                    setRegErrors(p => ({ ...p, mobileNumber: '' }));
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm
                    ${regErrors.mobileNumber ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                  placeholder="9XXXXXXXXX"
                />
                {regErrors.mobileNumber && <p className="text-xs text-red-600 mt-1">{regErrors.mobileNumber}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Credit Limit (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={regForm.creditLimit}
                  onChange={e => {
                    setRegForm(p => ({ ...p, creditLimit: e.target.value }));
                    setRegErrors(p => ({ ...p, creditLimit: '' }));
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm
                    ${regErrors.creditLimit ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                  placeholder="5000"
                />
                {regErrors.creditLimit && <p className="text-xs text-red-600 mt-1">{regErrors.creditLimit}</p>}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowReg(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReg}
                  className="px-5 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 shadow-md text-sm disabled:opacity-60 transition-colors"
                >
                  {savingReg ? 'Registering...' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Repayment Modal ── */}
      {showRepay && selectedCust?.creditAccount && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Record Repayment</h3>
              <button onClick={() => setShowRepay(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
                ×
              </button>
            </div>
            <form onSubmit={handleRepay} noValidate className="p-6 space-y-4">
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm flex justify-between items-center">
                <span className="text-red-700 font-medium">Outstanding Due</span>
                <span className="text-red-800 font-black text-lg">
                  ₹{selectedCust.creditAccount.currentDue.toFixed(2)}
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Quick Fill</p>
                <div className="flex gap-2">
                  {[
                    { label: '25%', f: 0.25 },
                    { label: '50%', f: 0.5 },
                    { label: '75%', f: 0.75 },
                    { label: 'Full', f: 1 },
                  ].map(o => (
                    <button
                      key={o.label}
                      type="button"
                      onClick={() => quickFill(o.f)}
                      className="flex-1 text-xs py-1.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 rounded-lg font-semibold transition-colors border border-slate-200 hover:border-teal-300"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={repayAmt}
                  onChange={e => { setRepayAmt(e.target.value); setRepayError(''); }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm
                    ${repayError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                  placeholder="0.00"
                />
                {repayError && <p className="text-xs text-red-600 mt-1">{repayError}</p>}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRepay(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRepay}
                  className="px-5 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 shadow-md text-sm disabled:opacity-60 transition-colors"
                >
                  {savingRepay ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
