'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Topbar from '@/components/Topbar';
import { apiClient } from '@/lib/api';
import DocumentTemplate, { StoreProfile, DocumentData } from '@/components/documents/DocumentTemplate';
import { DocLang, DocType, loadAllDocMeta, DocMeta, saveDocMeta } from '@/lib/docTranslations';

// ── Types ──────────────────────────────────────────────────────────────────
type InvoiceItem = {
  id: string;
  name: string;
  sku?: string | null;
  hsnSac?: string | null;
  unit: string;
  gstRateDefault?: number | null;
};

type InvoiceLine = {
  id: string;
  qty: number;
  unitPrice: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  item: InvoiceItem;
};

type Customer = {
  id: string;
  name?: string | null;
  mobileNumber: string;
};

type Invoice = {
  id: string;
  invoiceSequence: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  paymentMode: string;
  rewardPointsEarned: number;
  rewardPointsRedeemed: number;
  status: string;
  createdAt: string;
  customer?: Customer | null;
  lines: InvoiceLine[];
};

type TypeFilter = 'ALL' | 'BILL' | 'INVOICE';
type LangFilter = 'ALL' | 'EN' | 'TA';

// ── Helpers ────────────────────────────────────────────────────────────────
function invoiceToDocData(inv: Invoice): DocumentData {
  return {
    id: inv.id,
    invoiceSequence: inv.invoiceSequence,
    createdAt: inv.createdAt,
    paymentMode: inv.paymentMode,
    subtotal: inv.subtotal,
    taxTotal: inv.taxTotal,
    grandTotal: inv.grandTotal,
    rewardPointsEarned: inv.rewardPointsEarned,
    rewardPointsRedeemed: inv.rewardPointsRedeemed,
    customer: inv.customer ?? null,
    lines: inv.lines.map(l => ({
      id: l.id,
      qty: l.qty,
      unitPrice: l.unitPrice,
      taxableValue: l.taxableValue,
      cgst: l.cgst,
      sgst: l.sgst,
      igst: l.igst,
      item: {
        name: l.item.name,
        sku: l.item.sku ?? null,
        unit: l.item.unit,
        hsnSac: l.item.hsnSac ?? null,
        gstRateDefault: l.item.gstRateDefault ?? 0,
      },
    })),
  };
}

function paymentBadgeCls(mode: string): string {
  const base = 'text-[9px] font-black px-1.5 py-0.5 rounded uppercase';
  if (mode === 'CREDIT') return `${base} bg-red-50 text-red-600`;
  if (mode === 'CASH')   return `${base} bg-emerald-50 text-emerald-700`;
  if (mode === 'CARD')   return `${base} bg-blue-50 text-blue-700`;
  if (mode === 'UPI')    return `${base} bg-purple-50 text-purple-700`;
  return `${base} bg-slate-100 text-slate-600`;
}

function ListSkeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i}>
          <div className="h-3.5 bg-slate-100 rounded w-1/3 mb-1.5" />
          <div className="h-3 bg-slate-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [allDocMeta, setAllDocMeta] = useState<Record<string, DocMeta>>({});

  // ── Filter state ──
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [langFilter, setLangFilter] = useState<LangFilter>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  // ── Selection + preview ──
  const [selectedInvoice, setSelectedInvoice]   = useState<Invoice | null>(null);
  const [previewDocType, setPreviewDocType]     = useState<DocType>('INVOICE');
  const [previewDocLang, setPreviewDocLang]     = useState<DocLang>('EN');

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [invRes, profileRes] = await Promise.all([
        apiClient.get('/reports/invoices'),
        apiClient.get('/settings/profile').catch(() => ({ data: {} })),
      ]);
      setInvoices(invRes.data.invoices ?? []);
      if (profileRes.data.profile) setStoreProfile(profileRes.data.profile);
      setAllDocMeta(loadAllDocMeta());
    } catch {
      /* silently ignore — list will stay empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Select invoice — load its saved doc meta ──
  const selectInvoice = useCallback((inv: Invoice) => {
    setSelectedInvoice(inv);
    const meta = allDocMeta[inv.id];
    if (meta) {
      setPreviewDocType(meta.docType);
      setPreviewDocLang(meta.docLang);
    } else {
      setPreviewDocType('INVOICE');
      setPreviewDocLang('EN');
    }
  }, [allDocMeta]);

  // ── Filtered list ──
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (search) {
        const q = search.toLowerCase();
        const hit = (
          inv.invoiceSequence.toLowerCase().includes(q) ||
          (inv.customer?.name?.toLowerCase().includes(q) ?? false) ||
          (inv.customer?.mobileNumber.includes(q) ?? false)
        );
        if (!hit) return false;
      }
      if (typeFilter !== 'ALL') {
        const meta = allDocMeta[inv.id];
        if (!meta || meta.docType !== typeFilter) return false;
      }
      if (langFilter !== 'ALL') {
        const meta = allDocMeta[inv.id];
        if (!meta || meta.docLang !== langFilter) return false;
      }
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(inv.createdAt) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(inv.createdAt) > to) return false;
      }
      return true;
    });
  }, [invoices, search, typeFilter, langFilter, dateFrom, dateTo, allDocMeta]);

  // ── Print / Save PDF ──
  const handlePrint = useCallback(() => {
    if (selectedInvoice) {
      saveDocMeta(selectedInvoice.id, {
        docType: previewDocType,
        docLang: previewDocLang,
        generatedAt: new Date().toISOString(),
      });
      setAllDocMeta(loadAllDocMeta());
    }
    window.print();
  }, [selectedInvoice, previewDocType, previewDocLang]);

  // ── Summary stats ──
  const totalValue = useMemo(
    () => filteredInvoices.reduce((s, i) => s + i.grandTotal, 0),
    [filteredInvoices],
  );

  return (
    <>
      {/* Print-only: just the document */}
      {selectedInvoice && (
        <div className="hidden print:block">
          <DocumentTemplate
            invoice={invoiceToDocData(selectedInvoice)}
            storeProfile={storeProfile ?? { name: 'Store' }}
            docType={previewDocType}
            docLang={previewDocLang}
          />
        </div>
      )}

      <div className="dark-app flex flex-col h-screen print:hidden">
        <Topbar printHidden />

        <main className="flex-1 flex overflow-hidden">

          {/* ════ LEFT: Invoice list ════ */}
          <div className="w-[42%] flex flex-col bg-white border-r border-slate-200">

            {/* ── Header + filters ── */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-200 bg-slate-50 shrink-0 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-800 tracking-tight">Invoice Records</h2>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800">
                    {filteredInvoices.length} records
                  </span>
                  {filteredInvoices.length > 0 && (
                    <p className="text-[10px] text-slate-500">
                      &#8377;{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
                    </p>
                  )}
                </div>
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder="Invoice no., customer name or mobile..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-violet-500 outline-none"
              />

              {/* Type filter */}
              <div className="flex gap-1">
                {(['ALL', 'BILL', 'INVOICE'] as TypeFilter[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                      typeFilter === t
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                    }`}
                  >
                    {t === 'ALL' ? 'All Types' : t === 'BILL' ? 'Bills' : 'Tax Invoices'}
                  </button>
                ))}
              </div>

              {/* Language filter */}
              <div className="flex gap-1">
                {(['ALL', 'EN', 'TA'] as LangFilter[]).map(l => (
                  <button
                    key={l}
                    onClick={() => setLangFilter(l)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                      langFilter === l
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                    }`}
                  >
                    {l === 'ALL' ? 'All Languages' : l === 'EN' ? 'English' : 'Tamil'}
                  </button>
                ))}
              </div>

              {/* Date range */}
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-[10px] text-slate-600 bg-white focus:ring-1 focus:ring-violet-500 outline-none"
                />
                <span className="text-slate-400 text-[10px] shrink-0">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-[10px] text-slate-600 bg-white focus:ring-1 focus:ring-violet-500 outline-none"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="text-slate-400 hover:text-red-500 text-sm px-1 shrink-0"
                    title="Clear date filter"
                  >
                    &#215;
                  </button>
                )}
              </div>
            </div>

            {/* ── Invoice list ── */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <ListSkeleton />
              ) : filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-12">
                  <p className="text-sm font-medium">No invoices found</p>
                  <p className="text-xs">Try adjusting your filters</p>
                </div>
              ) : (
                filteredInvoices.map(inv => {
                  const meta = allDocMeta[inv.id];
                  const isSelected = selectedInvoice?.id === inv.id;
                  return (
                    <div
                      key={inv.id}
                      onClick={() => selectInvoice(inv)}
                      className={`px-4 py-3 cursor-pointer transition-all border-l-4 ${
                        isSelected
                          ? 'bg-violet-50 border-l-violet-500'
                          : 'hover:bg-slate-50 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-slate-800 text-sm leading-tight">
                              {inv.invoiceSequence}
                            </span>
                            {meta ? (
                              <>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">
                                  {meta.docType === 'BILL' ? 'BILL' : 'INV'}
                                </span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                  {meta.docLang}
                                </span>
                              </>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                                not printed
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(inv.createdAt).toLocaleString('en-IN', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </div>
                          {inv.customer && (
                            <div className="text-[11px] text-slate-600 mt-1 font-medium truncate">
                              {inv.customer.name || 'Walk-In'} &middot; {inv.customer.mobileNumber}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-black text-slate-900 text-sm">
                            &#8377;{inv.grandTotal.toFixed(2)}
                          </div>
                          <span className={paymentBadgeCls(inv.paymentMode)}>
                            {inv.paymentMode}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ════ RIGHT: Preview pane ════ */}
          <div className="flex-1 flex flex-col bg-slate-100 min-w-0">
            {selectedInvoice ? (
              <>
                {/* ── Preview controls ── */}
                <div className="px-4 py-2.5 bg-white border-b border-slate-200 shrink-0 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                    Format:
                  </span>

                  {(['BILL', 'INVOICE'] as DocType[]).map(dt => (
                    <button
                      key={dt}
                      onClick={() => setPreviewDocType(dt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        previewDocType === dt
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                      }`}
                    >
                      {dt === 'BILL' ? 'Bill of Supply' : 'Tax Invoice'}
                    </button>
                  ))}

                  <div className="w-px h-5 bg-slate-200 shrink-0" />

                  {(['EN', 'TA'] as DocLang[]).map(dl => (
                    <button
                      key={dl}
                      onClick={() => setPreviewDocLang(dl)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        previewDocLang === dl
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                      }`}
                    >
                      {dl === 'EN' ? 'English' : 'Tamil — தமிழ்'}
                    </button>
                  ))}

                  <div className="ml-auto flex items-center gap-2 shrink-0">
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-colors border"
                      style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-card-border)', color: 'inherit' }}
                    >
                      &#128424; Print
                    </button>
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      &#128190; Save PDF
                    </button>
                  </div>
                </div>

                {/* ── Document preview ── */}
                <div className="flex-1 overflow-y-auto p-6 flex justify-center">
                  <div
                    className={`doc-preview-reset w-full shadow-lg rounded-xl overflow-hidden ${
                      previewDocType === 'BILL' ? 'max-w-sm' : 'max-w-2xl'
                    }`}
                    style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)' }}
                  >
                    <DocumentTemplate
                      invoice={invoiceToDocData(selectedInvoice)}
                      storeProfile={storeProfile ?? { name: 'Store' }}
                      docType={previewDocType}
                      docLang={previewDocLang}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center text-3xl text-slate-300">
                  &#128196;
                </div>
                <p className="text-sm font-medium text-slate-500">Select an invoice to preview</p>
                <p className="text-xs text-slate-400 text-center max-w-[220px] leading-relaxed">
                  Choose Bill of Supply or Tax Invoice in English or Tamil — then print or save as PDF
                </p>
              </div>
            )}
          </div>

        </main>
      </div>
    </>
  );
}
