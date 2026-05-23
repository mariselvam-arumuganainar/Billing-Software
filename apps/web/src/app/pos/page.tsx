'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import Topbar from '@/components/Topbar';
import DocumentTemplate, { StoreProfile, DocumentData } from '@/components/documents/DocumentTemplate';
import { DocType, DocLang, saveDocMeta } from '@/lib/docTranslations';

// ── Types ──────────────────────────────────────────────────────────────────
type Item = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit: string;
  price: number;
  gstRateDefault: number;
  hsnSac?: string | null;
  stockQty: number;
  isActive?: boolean;
  imageUrl?: string | null;
};

type CartItem = Item & {
  quantity: number;
  lineSubtotal: number;
  lineCgst: number;
  lineSgst: number;
  lineGst: number;
  lineTotal: number;
};

type CreditAccount = { id: string; creditLimit: number; currentDue: number };

type Customer = {
  id: string;
  name: string | null;
  mobileNumber: string;
  totalRewardPoints: number;
  creditAccount?: CreditAccount | null;
};

type PaymentMode = 'CASH' | 'CARD' | 'UPI' | 'CREDIT' | 'SPLIT';

type InvoiceResult = {
  id: string;
  invoiceSequence: string;
  grandTotal: number;
  paymentMode: string;
  rewardPointsEarned: number;
  rewardPointsRedeemed: number;
};

type CheckoutSnapshot = {
  invoice: InvoiceResult;
  customer: Customer | null;
  cartLines: CartItem[];
  subtotal: number;
  taxTotal: number;
};

function buildDocData(snap: CheckoutSnapshot): DocumentData {
  return {
    id: snap.invoice.id,
    invoiceSequence: snap.invoice.invoiceSequence,
    createdAt: new Date().toISOString(),
    paymentMode: snap.invoice.paymentMode,
    subtotal: snap.subtotal,
    taxTotal: snap.taxTotal,
    grandTotal: snap.invoice.grandTotal,
    rewardPointsEarned: snap.invoice.rewardPointsEarned,
    rewardPointsRedeemed: snap.invoice.rewardPointsRedeemed,
    customer: snap.customer
      ? { name: snap.customer.name, mobileNumber: snap.customer.mobileNumber }
      : null,
    lines: snap.cartLines.map(ci => ({
      id: ci.id,
      qty: ci.quantity,
      unitPrice: ci.price,
      taxableValue: ci.lineSubtotal,
      cgst: ci.lineCgst,
      sgst: ci.lineSgst,
      igst: 0,
      item: {
        name: ci.name,
        sku: ci.sku ?? null,
        unit: ci.unit,
        hsnSac: ci.hsnSac ?? null,
        gstRateDefault: ci.gstRateDefault,
      },
    })),
  };
}

// ── Constants ──────────────────────────────────────────────────────────────
const SPLIT_MODES: ('CASH' | 'CARD' | 'UPI')[] = ['CASH', 'CARD', 'UPI'];
const PAYMENT_MODES: PaymentMode[] = ['CASH', 'CARD', 'UPI', 'CREDIT', 'SPLIT'];
const AVATAR_COLORS = [
  'bg-teal-500', 'bg-indigo-500', 'bg-violet-500',
  'bg-amber-500', 'bg-rose-500', 'bg-sky-500',
];
// Points earn rate fallback — real rate comes from TenantSettings (not yet exposed in API)
const EARN_RATE = 0.1;

// ── Helpers ────────────────────────────────────────────────────────────────
function avatarColor(name: string | null): string {
  return AVATAR_COLORS[(name ?? 'A').charCodeAt(0) % AVATAR_COLORS.length];
}
function initial(name: string | null): string {
  return (name ?? 'A')[0].toUpperCase();
}

function buildCartItem(base: Item, qty: number): CartItem {
  const lineSubtotal = base.price * qty;
  const lineGst = (lineSubtotal * base.gstRateDefault) / 100;
  const half = lineGst / 2;
  return {
    ...base,
    quantity: qty,
    lineSubtotal,
    lineCgst: half,
    lineSgst: half,
    lineGst,
    lineTotal: lineSubtotal + lineGst,
  };
}

function stockLevel(qty: number): 'out' | 'low' | 'ok' {
  if (qty <= 0) return 'out';
  if (qty <= 5) return 'low';
  return 'ok';
}

// ── Sub-components ─────────────────────────────────────────────────────────

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 animate-pulse">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="h-24 bg-slate-100 rounded-xl" />
      ))}
    </div>
  );
}

function ItemCard({
  item,
  isSelected,
  onAdd,
}: {
  item: Item;
  isSelected: boolean;
  onAdd: (item: Item) => void;
}) {
  const level = stockLevel(item.stockQty);
  const stockBadge = {
    out: { cls: 'bg-red-100 text-red-700', label: 'Out of stock' },
    low: { cls: 'bg-amber-50 text-amber-700', label: `${item.stockQty} left` },
    ok:  { cls: 'bg-emerald-50 text-emerald-700', label: `${item.stockQty}` },
  }[level];

  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      disabled={level === 'out'}
      className={`w-full text-left p-3 rounded-xl border transition-all outline-none
        ${level === 'out'
          ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50'
          : isSelected
            ? 'border-teal-500 bg-teal-50 shadow-md ring-2 ring-teal-500/20'
            : 'border-slate-200 bg-white hover:border-teal-300 hover:shadow-sm active:scale-[0.98]'
        }`}
    >
      <div className="flex items-start gap-2.5">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-200"
          />
        ) : (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-sm shrink-0 ${avatarColor(item.name)}`}>
            {initial(item.name)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-xs leading-tight truncate">{item.name}</p>
          {item.sku && (
            <p className="text-slate-400 text-[10px] font-mono mt-0.5 truncate">{item.sku}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-teal-700 font-black text-sm">&#8377;{item.price.toFixed(2)}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${stockBadge.cls}`}>
              {stockBadge.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] text-slate-400">{item.unit}</span>
            {item.gstRateDefault > 0 && (
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                GST {item.gstRateDefault}%
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function CartRow({
  item,
  onQtyChange,
  onRemove,
}: {
  item: CartItem;
  onQtyChange: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}) {
  const atLimit = item.quantity >= item.stockQty;
  return (
    <div className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs group transition-colors
      ${atLimit ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}
    >
      {/* Name + price */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 truncate leading-tight">{item.name}</p>
        <p className="text-slate-400 mt-0.5">
          &#8377;{item.price.toFixed(2)}
          {item.gstRateDefault > 0 && (
            <span className="ml-1 text-slate-300">+ {item.gstRateDefault}% GST</span>
          )}
        </p>
        {atLimit && (
          <p className="text-amber-600 text-[10px] font-semibold mt-0.5">Max stock ({item.stockQty}) reached</p>
        )}
      </div>

      {/* Qty stepper */}
      <div className="flex items-center rounded-lg bg-slate-100 shrink-0">
        <button
          onClick={() => onQtyChange(item.id, -1)}
          className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-red-600 font-bold rounded-md transition-colors"
        >
          &#8722;
        </button>
        <span className="w-7 text-center font-black text-slate-800">{item.quantity}</span>
        <button
          onClick={() => onQtyChange(item.id, 1)}
          disabled={atLimit}
          className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-teal-600 font-bold rounded-md transition-colors disabled:opacity-30"
        >
          +
        </button>
      </div>

      {/* Line total */}
      <div className="text-right shrink-0 w-[72px]">
        <p className="font-black text-slate-800">&#8377;{item.lineTotal.toFixed(2)}</p>
        {item.gstRateDefault > 0 && (
          <p className="text-[10px] text-slate-400">+&#8377;{item.lineGst.toFixed(2)} tax</p>
        )}
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(item.id)}
        className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
        title="Remove"
      >
        &#215;
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function POSPage() {
  // ── Data state ──
  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Cart state ──
  const [cart, setCart] = useState<CartItem[]>([]);

  // ── Search state ──
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customerSearch, setCustomerSearch] = useState('');

  // ── Customer + billing state ──
  const [linkedCustomer, setLinkedCustomer] = useState<Customer | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [cardRef, setCardRef] = useState('');
  const [upiRef, setUpiRef] = useState('');
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({
    CASH: '', CARD: '', UPI: '',
  });

  // ── UI state ──
  const [checkingOut, setCheckingOut] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [successInvoice, setSuccessInvoice] = useState<InvoiceResult | null>(null);
  const [showQuickReg, setShowQuickReg] = useState(false);
  const [quickRegForm, setQuickRegForm] = useState({ name: '', mobileNumber: '' });
  const [quickRegError, setQuickRegError] = useState('');
  const [savingReg, setSavingReg] = useState(false);

  // ── Document selection state ──
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [docType, setDocType] = useState<DocType>('BILL');
  const [docLang, setDocLang] = useState<DocLang>('EN');
  const [checkoutSnapshot, setCheckoutSnapshot] = useState<CheckoutSnapshot | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const customerSearchRef = useRef<HTMLInputElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toast ──
  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsRes, custsRes, profileRes] = await Promise.all([
        apiClient.get('/items'),
        apiClient.get('/customers'),
        apiClient.get('/settings/profile').catch(() => ({ data: {} })),
      ]);
      setCatalogItems(itemsRes.data.items ?? []);
      setCustomers(custsRes.data.customers ?? []);
      if (profileRes.data.profile) setStoreProfile(profileRes.data.profile);
    } catch {
      showToast('Failed to load POS data — please refresh the page.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived: catalog ──
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalogItems.filter(item => {
      if (item.isActive === false) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.sku?.toLowerCase().includes(q) ?? false) ||
        (item.hsnSac?.toLowerCase().includes(q) ?? false) ||
        (item.barcode?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [catalogItems, search]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return [];
    return customers.filter(c =>
      (c.name?.toLowerCase().includes(q) ?? false) || c.mobileNumber.includes(q)
    );
  }, [customers, customerSearch]);

  // ── Derived: billing math ──
  const subtotal  = useMemo(() => cart.reduce((a, c) => a + c.lineSubtotal, 0), [cart]);
  const cgstTotal = useMemo(() => cart.reduce((a, c) => a + c.lineCgst, 0), [cart]);
  const sgstTotal = useMemo(() => cart.reduce((a, c) => a + c.lineSgst, 0), [cart]);
  const taxTotal  = useMemo(() => cgstTotal + sgstTotal, [cgstTotal, sgstTotal]);

  const maxRedeemable = useMemo(() => {
    if (!linkedCustomer || !redeemPoints) return 0;
    return Math.min(linkedCustomer.totalRewardPoints, subtotal + taxTotal);
  }, [linkedCustomer, redeemPoints, subtotal, taxTotal]);

  const grandTotal  = useMemo(() => Math.max(0, subtotal + taxTotal - maxRedeemable), [subtotal, taxTotal, maxRedeemable]);
  const pointsToEarn = useMemo(() => subtotal * EARN_RATE, [subtotal]);

  // ── Derived: credit ──
  const creditAccount      = linkedCustomer?.creditAccount ?? null;
  const creditProjectedDue = creditAccount ? creditAccount.currentDue + grandTotal : 0;
  const creditWillExceed   = !!creditAccount && creditProjectedDue > creditAccount.creditLimit;
  const creditUtil         = (creditAccount && creditAccount.creditLimit > 0)
    ? Math.min(100, (creditAccount.currentDue / creditAccount.creditLimit) * 100)
    : 0;

  // ── Derived: split ──
  const splitTotal = useMemo(
    () => SPLIT_MODES.reduce((acc, m) => acc + (parseFloat(splitAmounts[m] || '0') || 0), 0),
    [splitAmounts],
  );
  const splitRemaining = useMemo(() => Math.max(0, grandTotal - splitTotal), [grandTotal, splitTotal]);
  const splitBalanced  = useMemo(() => Math.abs(splitTotal - grandTotal) < 0.005, [splitTotal, grandTotal]);

  // ── Derived: cash change ──
  const cashChange = useMemo(() => {
    const received = parseFloat(cashReceived) || 0;
    return received >= grandTotal && grandTotal > 0 ? received - grandTotal : null;
  }, [cashReceived, grandTotal]);

  // ── Checkout block reason ──
  const checkoutBlocked = useMemo((): string | null => {
    if (cart.length === 0) return 'Add items to the cart first';
    if (paymentMode === 'CREDIT') {
      if (!linkedCustomer) return 'Link a customer to use credit billing';
      if (!creditAccount) return 'Customer has no credit account set up';
      if (creditWillExceed)
        return `Credit limit exceeded — projected due ₹${creditProjectedDue.toFixed(2)} / limit ₹${creditAccount.creditLimit.toFixed(2)}`;
    }
    if (paymentMode === 'SPLIT' && !splitBalanced)
      return `Split total ₹${splitTotal.toFixed(2)} must equal ₹${grandTotal.toFixed(2)} (₹${splitRemaining.toFixed(2)} remaining)`;
    return null;
  }, [cart.length, paymentMode, linkedCustomer, creditAccount, creditWillExceed, creditProjectedDue, splitBalanced, splitTotal, grandTotal, splitRemaining]);

  // ── Cart operations ──
  const addToCart = useCallback((item: Item) => {
    if (item.stockQty <= 0) return;
    setCart(prev => {
      const existing = prev.find(e => e.id === item.id);
      if (existing) {
        const newQty = Math.min(item.stockQty, existing.quantity + 1);
        return prev.map(e => e.id === item.id ? buildCartItem(e, newQty) : e);
      }
      return [...prev, buildCartItem(item, 1)];
    });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      const newQty = Math.min(item.stockQty, Math.max(1, item.quantity + delta));
      return buildCartItem(item, newQty);
    }));
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const resetBill = useCallback(() => {
    setCart([]);
    setLinkedCustomer(null);
    setRedeemPoints(false);
    setPaymentMode('CASH');
    setCashReceived('');
    setCardRef('');
    setUpiRef('');
    setSplitAmounts({ CASH: '', CARD: '', UPI: '' });
  }, []);

  // ── Checkout ──
  const handleCheckout = useCallback(async () => {
    if (checkoutBlocked) { showToast(checkoutBlocked, 'error'); return; }
    try {
      setCheckingOut(true);
      const payload = {
        customerId: linkedCustomer?.id ?? null,
        paymentMode,
        redeemPoints,
        items: cart.map(item => ({ itemId: item.id, quantity: item.quantity })),
      };
      const res = await apiClient.post('/billing/checkout', payload);
      const inv: InvoiceResult = res.data.invoice;
      setCheckoutSnapshot({
        invoice: inv,
        customer: linkedCustomer,
        cartLines: [...cart],
        subtotal,
        taxTotal,
      });
      setSuccessInvoice(inv);
      resetBill();
      await fetchData();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Checkout failed — please try again.', 'error');
    } finally {
      setCheckingOut(false);
    }
  }, [checkoutBlocked, linkedCustomer, paymentMode, redeemPoints, cart, showToast, resetBill, fetchData, subtotal, taxTotal]);

  // ── Quick register ──
  const handleQuickRegister = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const mobile = quickRegForm.mobileNumber.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setQuickRegError('Enter a valid 10-digit Indian mobile number (starts with 6–9)');
      return;
    }
    if (!quickRegForm.name.trim()) {
      setQuickRegError('Customer name is required');
      return;
    }
    setSavingReg(true);
    try {
      const { data } = await apiClient.post('/customers', {
        name: quickRegForm.name.trim(),
        mobileNumber: mobile,
        creditLimit: 5000,
      });
      const created: Customer = data.customer;
      setLinkedCustomer(created);
      setCustomers(prev => [...prev, created]);
      setShowQuickReg(false);
      setQuickRegForm({ name: '', mobileNumber: '' });
      setQuickRegError('');
      showToast(`"${created.name || mobile}" registered and linked`, 'success');
    } catch (err: any) {
      setQuickRegError(err.response?.data?.error ?? 'Registration failed — please try again');
    } finally {
      setSavingReg(false);
    }
  }, [quickRegForm, showToast]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        customerSearchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (successInvoice) { setSuccessInvoice(null); setCheckoutSnapshot(null); }
        if (showQuickReg) setShowQuickReg(false);
      }
      if (e.key === 'ArrowDown' && document.activeElement === searchInputRef.current) {
        e.preventDefault();
        setSelectedIndex(p => Math.min(p + 1, Math.max(filteredItems.length - 1, 0)));
      }
      if (e.key === 'ArrowUp' && document.activeElement === searchInputRef.current) {
        e.preventDefault();
        setSelectedIndex(p => Math.max(p - 1, 0));
      }
      if (
        e.key === 'Enter' &&
        search &&
        filteredItems.length > 0 &&
        document.activeElement === searchInputRef.current
      ) {
        e.preventDefault();
        addToCart(filteredItems[selectedIndex]);
        setSearch('');
        setSelectedIndex(0);
      }
      if (e.key === 'F12' && !checkoutBlocked && !checkingOut) {
        e.preventDefault();
        handleCheckout();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [search, filteredItems, selectedIndex, addToCart, checkoutBlocked, checkingOut, handleCheckout, successInvoice, showQuickReg]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Print-only document — hidden on screen, visible during browser print/PDF */}
      {checkoutSnapshot && (
        <div className="hidden print:block">
          <DocumentTemplate
            invoice={buildDocData(checkoutSnapshot)}
            storeProfile={storeProfile ?? { name: 'Store' }}
            docType={docType}
            docLang={docLang}
          />
        </div>
      )}

      <div className="dark-app flex flex-col h-screen print:hidden">
      <Topbar printHidden />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white transition-all
            ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}
        >
          <span className="font-black">{toast.type === 'success' ? '✓' : '!'}</span>
          <span className="flex-1 max-w-xs">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 text-lg leading-none ml-1">
            &#215;
          </button>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ── Compact top header ── */}
        <div className="h-10 flex items-center justify-between px-4 shrink-0" style={{borderBottom:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)'}}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-slate-800 tracking-tight">POS Billing</span>
            <span className="text-slate-300 text-xs">|</span>
            <span className="text-xs text-slate-500">Billing Terminal</span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Online
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-[10px] text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded font-mono text-white/60" style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)'}}>F2</kbd>
              Search
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded font-mono text-white/60" style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)'}}>F4</kbd>
              Customer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded font-mono text-white/60" style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)'}}>&#8593;&#8595;</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded font-mono text-white/60" style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)'}}>Enter</kbd>
              Add item
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded font-mono text-white/60" style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)'}}>F12</kbd>
              Checkout
            </span>
          </div>
        </div>

        {/* ── Main POS area ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ════ LEFT: Product Discovery ════ */}
          <div className="w-[57%] flex flex-col" style={{borderRight:'1px solid rgba(255,255,255,0.08)'}}>

            {/* Search bar */}
            <div className="p-3 border-b border-slate-100 shrink-0">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSelectedIndex(0); }}
                  placeholder="Search by name, SKU or HSN code... (F2)"
                  className="w-full px-4 py-2.5 bg-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm outline-none transition-all"
                />
                {search && (
                  <button
                    onClick={() => { setSearch(''); setSelectedIndex(0); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    &#215;
                  </button>
                )}
              </div>
            </div>

            {/* Catalog grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <CatalogSkeleton />
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-12">
                  <p className="text-sm font-medium">
                    {search ? 'No items match your search' : 'No catalog items available'}
                  </p>
                  {search && <p className="text-xs text-slate-300">Try name, SKU, or HSN code</p>}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 auto-rows-max">
                  {filteredItems.map((item, idx) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      isSelected={idx === selectedIndex && search.length > 0}
                      onAdd={addToCart}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ════ RIGHT: Bill Builder ════ */}
          <div className="w-[43%] flex flex-col" style={{background:'rgba(255,255,255,0.03)'}}>

            {/* ── Customer link section ── */}
            <div className="px-3 pt-3 pb-2.5 shrink-0" style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
              {linkedCustomer ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${avatarColor(linkedCustomer.name)}`}>
                      {initial(linkedCustomer.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-sm truncate">
                          {linkedCustomer.name || 'Anonymous Customer'}
                        </span>
                        <button
                          onClick={() => { setLinkedCustomer(null); setRedeemPoints(false); setCustomerSearch(''); }}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold shrink-0 ml-2"
                        >
                          &#215; Unlink
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{linkedCustomer.mobileNumber}</p>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[11px]">
                        <span className="text-emerald-700 font-semibold">
                          {linkedCustomer.totalRewardPoints.toFixed(1)} pts
                        </span>
                        {creditAccount && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span className={`font-semibold ${creditAccount.currentDue > 0 ? 'text-orange-600' : 'text-slate-500'}`}>
                              Due &#8377;{creditAccount.currentDue.toFixed(0)}
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-500">Limit &#8377;{creditAccount.creditLimit.toFixed(0)}</span>
                          </>
                        )}
                      </div>
                      {creditAccount && creditAccount.creditLimit > 0 && (
                        <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              creditUtil >= 90 ? 'bg-red-500' :
                              creditUtil >= 70 ? 'bg-orange-400' : 'bg-teal-500'
                            }`}
                            style={{ width: `${creditUtil}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</span>
                    <button
                      onClick={() => { setShowQuickReg(true); setQuickRegError(''); setQuickRegForm({ name: '', mobileNumber: '' }); }}
                      className="text-[10px] text-teal-600 hover:text-teal-700 font-semibold"
                    >
                      + Quick Register
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      ref={customerSearchRef}
                      type="text"
                      placeholder="Search customer by name or mobile (F4)..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                    {customerSearch && filteredCustomers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-xl z-30 max-h-44 overflow-y-auto divide-y divide-slate-100">
                        {filteredCustomers.map(c => (
                          <div
                            key={c.id}
                            onClick={() => { setLinkedCustomer(c); setCustomerSearch(''); }}
                            className="px-3 py-2 cursor-pointer hover:bg-teal-50 text-xs flex justify-between items-center"
                          >
                            <div>
                              <p className="font-bold text-slate-800">{c.name || 'Anonymous'}</p>
                              <p className="text-slate-400 text-[10px]">{c.mobileNumber}</p>
                            </div>
                            <span className="text-emerald-700 font-bold text-[11px]">{c.totalRewardPoints} pts</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {customerSearch && filteredCustomers.length === 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-xl z-30 px-3 py-2.5 text-xs text-slate-400">
                        No customer found —
                        <button
                          onClick={() => { setShowQuickReg(true); setQuickRegForm({ name: '', mobileNumber: customerSearch }); setCustomerSearch(''); setQuickRegError(''); }}
                          className="text-teal-600 font-semibold ml-1 hover:underline"
                        >
                          register new?
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Walk-in billing works without a customer. Rewards &amp; credit require a linked customer.
                  </p>
                </div>
              )}
            </div>

            {/* ── Cart items (scrollable) ── */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <span className="text-2xl text-slate-300">&#128179;</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Cart is empty</p>
                  <p className="text-xs text-slate-400 text-center leading-relaxed max-w-[200px]">
                    Click a product on the left or press Enter after searching to add items
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-0.5 mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {cart.length} line item{cart.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={resetBill}
                      className="text-[10px] text-red-500 hover:text-red-700 font-semibold"
                    >
                      Clear all
                    </button>
                  </div>
                  {cart.map(item => (
                    <CartRow key={item.id} item={item} onQtyChange={updateQty} onRemove={removeFromCart} />
                  ))}
                </>
              )}
            </div>

            {/* ══════════════════════════════════════════════════
                Billing Summary + Payment + Checkout (sticky)
            ══════════════════════════════════════════════════ */}
            <div className="shrink-0" style={{borderTop:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',boxShadow:'0 -6px 24px rgba(0,0,0,0.3)'}}>

              {/* GST breakdown + totals */}
              {cart.length > 0 && (
                <div className="px-4 pt-3 pb-2 border-b border-slate-100">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal (taxable value)</span>
                      <span className="font-semibold text-slate-700">&#8377;{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>CGST</span>
                      <span>&#8377;{cgstTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>SGST</span>
                      <span>&#8377;{sgstTotal.toFixed(2)}</span>
                    </div>
                    {redeemPoints && maxRedeemable > 0 && (
                      <div className="flex justify-between text-emerald-600 font-semibold">
                        <span>Reward redemption</span>
                        <span>&#8722; &#8377;{maxRedeemable.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-slate-900 border-t border-slate-200 pt-2 mt-1 text-sm">
                      <span>Grand Total</span>
                      <span>&#8377;{grandTotal.toFixed(2)}</span>
                    </div>
                    {linkedCustomer && pointsToEarn > 0 && (
                      <div className="flex justify-between text-emerald-600 text-[11px]">
                        <span>Est. points to earn</span>
                        <span className="font-semibold">+ {pointsToEarn.toFixed(1)} pts</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reward redemption toggle */}
              {linkedCustomer && linkedCustomer.totalRewardPoints > 0 && cart.length > 0 && (
                <div className="px-4 py-2 border-b border-slate-100">
                  <label className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 cursor-pointer">
                    <div className="text-xs">
                      <span className="font-bold text-emerald-700">Redeem reward points</span>
                      <span className="text-emerald-600 ml-1">
                        ({linkedCustomer.totalRewardPoints.toFixed(1)} available)
                      </span>
                      {redeemPoints && maxRedeemable > 0 && (
                        <span className="ml-1 text-emerald-500">
                          &#8594; save &#8377;{maxRedeemable.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={redeemPoints}
                      onChange={e => setRedeemPoints(e.target.checked)}
                      className="w-4 h-4 accent-teal-600 shrink-0"
                    />
                  </label>
                </div>
              )}

              {/* Payment mode selector */}
              <div className="px-4 pt-2.5 pb-2 border-b border-slate-100">
                <div className="grid grid-cols-5 gap-1.5 mb-2.5">
                  {PAYMENT_MODES.map(mode => (
                    <button
                      key={mode}
                      onClick={() => setPaymentMode(mode)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                        paymentMode === mode
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Mode-specific inputs */}
                {paymentMode === 'CASH' && grandTotal > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 shrink-0">Cash received &#8377;</span>
                    <input
                      type="number"
                      min={grandTotal}
                      step="1"
                      value={cashReceived}
                      onChange={e => setCashReceived(e.target.value)}
                      placeholder={grandTotal.toFixed(2)}
                      className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                    />
                    {cashChange !== null && (
                      <span className="font-black text-teal-700 shrink-0">
                        Change &#8377;{cashChange.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}

                {paymentMode === 'CARD' && (
                  <input
                    type="text"
                    value={cardRef}
                    onChange={e => setCardRef(e.target.value)}
                    placeholder="Card / POS terminal reference (optional)"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                  />
                )}

                {paymentMode === 'UPI' && (
                  <input
                    type="text"
                    value={upiRef}
                    onChange={e => setUpiRef(e.target.value)}
                    placeholder="UPI transaction reference ID (optional)"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                  />
                )}

                {paymentMode === 'CREDIT' && (
                  <div className={`rounded-xl border text-xs overflow-hidden ${creditWillExceed ? 'border-red-300' : 'border-emerald-200'}`}>
                    {!linkedCustomer ? (
                      <div className="px-3 py-2 bg-amber-50 text-amber-700 font-semibold">
                        Link a customer to use credit billing
                      </div>
                    ) : !creditAccount ? (
                      <div className="px-3 py-2 bg-red-50 text-red-700 font-semibold">
                        This customer has no credit account
                      </div>
                    ) : (
                      <div className={`px-3 py-2.5 space-y-1 ${creditWillExceed ? 'bg-red-50' : 'bg-emerald-50'}`}>
                        <div className="flex justify-between text-slate-600">
                          <span>Current outstanding</span>
                          <span className="font-semibold">&#8377;{creditAccount.currentDue.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>This bill</span>
                          <span className="font-semibold">+ &#8377;{grandTotal.toFixed(2)}</span>
                        </div>
                        <div className={`flex justify-between font-bold border-t pt-1 ${creditWillExceed ? 'text-red-700 border-red-200' : 'text-emerald-800 border-emerald-200'}`}>
                          <span>Projected due</span>
                          <span>&#8377;{creditProjectedDue.toFixed(2)} / &#8377;{creditAccount.creditLimit.toFixed(2)}</span>
                        </div>
                        {creditWillExceed && (
                          <p className="text-red-700 font-bold pt-0.5">
                            Exceeds credit limit — checkout blocked
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {paymentMode === 'SPLIT' && grandTotal > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                      Enter amounts per mode
                    </p>
                    {SPLIT_MODES.map(mode => (
                      <div key={mode} className="flex items-center gap-2 text-xs">
                        <span className="w-10 text-slate-600 font-bold shrink-0">{mode}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={splitAmounts[mode]}
                          onChange={e => setSplitAmounts(prev => ({ ...prev, [mode]: e.target.value }))}
                          placeholder="0.00"
                          className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                        />
                        <span className="text-slate-400 w-8 text-right shrink-0">
                          {parseFloat(splitAmounts[mode] || '0') > 0
                            ? `₹${parseFloat(splitAmounts[mode]).toFixed(0)}`
                            : ''}
                        </span>
                      </div>
                    ))}
                    <div className={`flex justify-between text-xs font-bold px-1 pt-1.5 border-t mt-1 ${
                      splitBalanced ? 'text-emerald-700 border-emerald-200' :
                      splitTotal > grandTotal ? 'text-red-600 border-red-200' : 'text-orange-600 border-orange-200'
                    }`}>
                      <span>
                        {splitBalanced
                          ? '✓ Balanced'
                          : splitTotal > grandTotal
                            ? `Exceeds by ₹${(splitTotal - grandTotal).toFixed(2)}`
                            : `₹${splitRemaining.toFixed(2)} remaining`}
                      </span>
                      <span>&#8377;{splitTotal.toFixed(2)} / &#8377;{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Checkout CTA */}
              <div className="px-4 pb-4 pt-2.5 space-y-2">
                {checkoutBlocked && cart.length > 0 && (
                  <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-semibold leading-snug">
                    {checkoutBlocked}
                  </div>
                )}
                <button
                  onClick={handleCheckout}
                  disabled={!!checkoutBlocked || checkingOut}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white py-3 rounded-xl font-black text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {checkingOut ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing transaction...
                    </>
                  ) : cart.length === 0 ? (
                    'Add items to bill'
                  ) : (
                    <>
                      Checkout — &#8377;{grandTotal.toFixed(2)}
                      <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-normal ml-1">F12</kbd>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* ════════════════════════════════════
          SUCCESS MODAL — 2-column: controls | live document preview
      ════════════════════════════════════ */}
      {successInvoice && checkoutSnapshot && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">

            {/* ── Compact success header ── */}
            <div className="bg-emerald-600 px-5 py-3 text-white flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <span className="text-base font-black">&#10003;</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm leading-tight">Payment Successful</p>
                <p className="text-emerald-100 text-[11px] font-mono tracking-wider mt-0.5">
                  {successInvoice.invoiceSequence} &middot; {successInvoice.paymentMode} &middot; &#8377;{successInvoice.grandTotal.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => { setSuccessInvoice(null); setCheckoutSnapshot(null); }}
                className="text-white/60 hover:text-white text-2xl leading-none ml-2"
                title="Close (Esc)"
              >
                &#215;
              </button>
            </div>

            {/* ── Body: left sidebar + right preview ── */}
            <div className="flex flex-1 overflow-hidden">

              {/* LEFT: controls */}
              <div className="w-60 shrink-0 border-r border-slate-200 flex flex-col p-4 gap-4 overflow-y-auto bg-slate-50">

                {/* Points chips */}
                {(successInvoice.rewardPointsEarned > 0 || successInvoice.rewardPointsRedeemed > 0) && (
                  <div className="space-y-1.5">
                    {successInvoice.rewardPointsEarned > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
                        <p className="text-emerald-700 font-black text-sm">
                          +{successInvoice.rewardPointsEarned.toFixed(1)} pts
                        </p>
                        <p className="text-emerald-500 text-[10px]">earned this bill</p>
                      </div>
                    )}
                    {successInvoice.rewardPointsRedeemed > 0 && (
                      <div className="bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-center">
                        <p className="text-slate-700 font-black text-sm">
                          &#8722;{successInvoice.rewardPointsRedeemed.toFixed(1)} pts
                        </p>
                        <p className="text-slate-400 text-[10px]">redeemed</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Document type */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Document Type</p>
                  <div className="space-y-1.5">
                    {(['BILL', 'INVOICE'] as DocType[]).map(dt => (
                      <button
                        key={dt}
                        onClick={() => setDocType(dt)}
                        className={`w-full py-2 rounded-xl text-xs font-bold border transition-all ${
                          docType === dt
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300'
                        }`}
                      >
                        {dt === 'BILL' ? 'Bill of Supply' : 'Tax Invoice'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Language</p>
                  <div className="space-y-1.5">
                    {(['EN', 'TA'] as DocLang[]).map(dl => (
                      <button
                        key={dl}
                        onClick={() => setDocLang(dl)}
                        className={`w-full py-2 rounded-xl text-xs font-bold border transition-all ${
                          docLang === dl
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        {dl === 'EN' ? 'English' : 'Tamil — தமிழ்'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1" />

                {/* Action buttons */}
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      saveDocMeta(successInvoice.id, { docType, docLang, generatedAt: new Date().toISOString() });
                      window.print();
                    }}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    &#128424; Print
                  </button>
                  <button
                    onClick={() => {
                      saveDocMeta(successInvoice.id, { docType, docLang, generatedAt: new Date().toISOString() });
                      window.print();
                    }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    &#128190; Save as PDF
                  </button>
                  <button
                    onClick={() => { setSuccessInvoice(null); setCheckoutSnapshot(null); }}
                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-colors active:scale-[0.98]"
                  >
                    New Bill
                  </button>
                </div>
              </div>

              {/* RIGHT: live document preview */}
              <div className="flex-1 overflow-y-auto bg-slate-200 p-5 flex justify-center">
                <div className={`w-full bg-white shadow-lg rounded-xl overflow-hidden border border-slate-300 ${
                  docType === 'BILL' ? 'max-w-xs' : 'max-w-2xl'
                }`}>
                  <DocumentTemplate
                    invoice={buildDocData(checkoutSnapshot)}
                    storeProfile={storeProfile ?? { name: 'Store' }}
                    docType={docType}
                    docLang={docLang}
                  />
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════
          QUICK REGISTER MODAL
      ════════════════════════════════════ */}
      {showQuickReg && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">Quick Register Customer</h3>
              <button
                onClick={() => { setShowQuickReg(false); setQuickRegError(''); setQuickRegForm({ name: '', mobileNumber: '' }); }}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                &#215;
              </button>
            </div>
            <form onSubmit={handleQuickRegister} noValidate className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickRegForm.name}
                  onChange={e => { setQuickRegForm(p => ({ ...p, name: e.target.value })); setQuickRegError(''); }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Customer name"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={quickRegForm.mobileNumber}
                  onChange={e => { setQuickRegForm(p => ({ ...p, mobileNumber: e.target.value.replace(/\D/g, '') })); setQuickRegError(''); }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="9XXXXXXXXX"
                />
              </div>
              {quickRegError && (
                <p className="text-xs text-red-600 font-medium">{quickRegError}</p>
              )}
              <p className="text-[10px] text-slate-400">
                Customer will be registered with a default credit limit of &#8377;5,000 and linked to this bill automatically.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowQuickReg(false); setQuickRegError(''); setQuickRegForm({ name: '', mobileNumber: '' }); }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReg}
                  className="px-5 py-2 bg-teal-600 text-white font-semibold rounded-lg text-sm hover:bg-teal-700 disabled:opacity-60 transition-colors"
                >
                  {savingReg ? 'Registering...' : 'Register & Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
