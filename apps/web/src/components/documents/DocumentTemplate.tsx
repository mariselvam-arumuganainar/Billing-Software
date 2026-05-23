'use client';

import { DocLang, DocType, getDocLabels, getFooterQuote } from '@/lib/docTranslations';

// ── Shared types ──────────────────────────────────────────────────────────
export type StoreProfile = {
  name: string;
  address?: string | null;
  gstNumber?: string | null;
  logoUrl?: string | null;
  storeMobile?: string | null;
  storeEmail?: string | null;
  storeWebsite?: string | null;
  state?: string | null;
  pincode?: string | null;
};

export type DocInvoiceLine = {
  id: string;
  qty: number;
  unitPrice: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  item: {
    name: string;
    sku?: string | null;
    unit: string;
    hsnSac?: string | null;
    gstRateDefault?: number;
  };
};

export type DocCustomer = {
  name?: string | null;
  mobileNumber: string;
};

export type DocumentData = {
  id: string;
  invoiceSequence: string;
  createdAt: string;
  paymentMode: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  rewardPointsEarned: number;
  rewardPointsRedeemed: number;
  customer?: DocCustomer | null;
  lines: DocInvoiceLine[];
};

export type DocumentTemplateProps = {
  invoice: DocumentData;
  storeProfile: StoreProfile;
  docType: DocType;
  docLang: DocLang;
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}
function gstRateOf(line: DocInvoiceLine): number {
  if (line.taxableValue <= 0) return 0;
  return Math.round(((line.cgst + line.sgst + line.igst) / line.taxableValue) * 100);
}

function amountInWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) {
      const rem = n % 10;
      return tens[Math.floor(n / 10)] + (rem ? ' ' + ones[rem] : '');
    }
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
  }

  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Rs. Zero Only';

  const parts: string[] = [];
  let rem = rupees;
  if (rem >= 10000000) { parts.push(convert(Math.floor(rem / 10000000)) + ' Crore'); rem %= 10000000; }
  if (rem >= 100000)   { parts.push(convert(Math.floor(rem / 100000))   + ' Lakh');  rem %= 100000;   }
  if (rem >= 1000)     { parts.push(convert(Math.floor(rem / 1000))     + ' Thousand'); rem %= 1000;  }
  if (rem > 0)         { parts.push(convert(rem)); }

  let words = 'Rs. ' + parts.join(' ');
  if (paise > 0) words += ' and ' + convert(paise) + ' Paise';
  return words + ' Only';
}

// ── Main export ────────────────────────────────────────────────────────────
export default function DocumentTemplate({
  invoice,
  storeProfile,
  docType,
  docLang,
}: DocumentTemplateProps) {
  return docType === 'BILL'
    ? <BillTemplate invoice={invoice} storeProfile={storeProfile} docLang={docLang} />
    : <InvoiceTemplate invoice={invoice} storeProfile={storeProfile} docLang={docLang} />;
}

// ══════════════════════════════════════════════════════════════════════════
// INVOICE TEMPLATE — A4, GST-compliant, professional style
// ══════════════════════════════════════════════════════════════════════════
function InvoiceTemplate({
  invoice,
  storeProfile,
  docLang,
}: {
  invoice: DocumentData;
  storeProfile: StoreProfile;
  docLang: DocLang;
}) {
  const L = getDocLabels(docLang, 'INVOICE');
  const quote = getFooterQuote(docLang, invoice.invoiceSequence);
  const isTamil = docLang === 'TA';

  const cgstTotal = invoice.lines.reduce((a, l) => a + l.cgst, 0);
  const sgstTotal = invoice.lines.reduce((a, l) => a + l.sgst, 0);
  const igstTotal = invoice.lines.reduce((a, l) => a + l.igst, 0);
  const hasIgst   = igstTotal > 0;

  // intrastate: 9 cols; interstate: 8 cols
  const colCount = hasIgst ? 8 : 9;

  return (
    <div className={`bg-white text-slate-900 ${isTamil ? 'font-tamil' : 'font-sans'} text-xs p-8`}>

      {/* ── Header: Logo left | Title + meta right ── */}
      <div className="flex items-start justify-between mb-6">

        {/* Logo / store monogram */}
        <div className="shrink-0">
          {storeProfile.logoUrl ? (
            <img
              src={storeProfile.logoUrl}
              alt={storeProfile.name}
              className="h-20 max-w-30 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-blue-600 flex items-center justify-center">
              <span className="text-white font-black text-4xl leading-none">
                {(storeProfile.name || 'S')[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Title + meta */}
        <div className="text-right">
          <h1 className="text-4xl font-black text-slate-900 mb-3">{L.documentTitle}</h1>
          <table className="ml-auto text-[11px]">
            <tbody>
              <tr>
                <td className="text-slate-400 pr-6 py-0.5">{L.documentNo}</td>
                <td className="font-bold font-mono text-right">{invoice.invoiceSequence}</td>
              </tr>
              <tr>
                <td className="text-slate-400 pr-6 py-0.5">{L.date}</td>
                <td className="text-right">{fmtDate(invoice.createdAt)}</td>
              </tr>
              <tr>
                <td className="text-slate-400 pr-6 py-0.5">{L.time}</td>
                <td className="text-right">{fmtTime(invoice.createdAt)}</td>
              </tr>
              <tr>
                <td className="text-slate-400 pr-6 py-0.5">{L.paymentMode}</td>
                <td className="font-bold text-right">{invoice.paymentMode}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── From / Bill To ── */}
      <div className="flex gap-8 mb-6 pb-6 border-b border-slate-200">
        {/* From — store details */}
        <div className="flex-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">From</p>
          <p className="font-black text-sm text-slate-900">{storeProfile.name}</p>
          {storeProfile.address && (
            <p className="text-[11px] text-slate-600 mt-0.5 whitespace-pre-line leading-relaxed">
              {storeProfile.address}
            </p>
          )}
          {storeProfile.storeMobile && (
            <p className="text-[11px] text-slate-600">{storeProfile.storeMobile}</p>
          )}
          {storeProfile.storeEmail && (
            <p className="text-[11px] text-slate-600">{storeProfile.storeEmail}</p>
          )}
          {storeProfile.gstNumber && (
            <p className="text-[11px] font-semibold mt-1 font-mono">{L.gstin}: {storeProfile.gstNumber}</p>
          )}
        </div>

        {/* Bill To — customer */}
        <div className="flex-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{L.customer}</p>
          {invoice.customer ? (
            <>
              <p className="font-black text-sm text-slate-900">
                {invoice.customer.name || L.walkIn}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {L.mobile}: {invoice.customer.mobileNumber}
              </p>
            </>
          ) : (
            <p className="font-semibold text-slate-600">{L.walkIn}</p>
          )}
        </div>
      </div>

      {/* ── Items table ── */}
      <table className="w-full border-collapse mb-6 text-[11px]">
        <thead>
          <tr className="text-white text-[10px] font-bold" style={{ backgroundColor: '#2563eb' }}>
            <th className="text-left px-3 py-2.5 rounded-tl">DESCRIPTION</th>
            <th className="text-center px-2 py-2.5">QTY</th>
            <th className="text-center px-2 py-2.5">UNIT</th>
            <th className="text-right px-2 py-2.5">RATE (₹)</th>
            <th className="text-right px-2 py-2.5">TAXABLE (₹)</th>
            <th className="text-center px-2 py-2.5">GST %</th>
            {hasIgst ? (
              <th className="text-right px-2 py-2.5">IGST (₹)</th>
            ) : (
              <>
                <th className="text-right px-2 py-2.5">CGST (₹)</th>
                <th className="text-right px-2 py-2.5">SGST (₹)</th>
              </>
            )}
            <th className="text-right px-3 py-2.5 rounded-tr">AMOUNT (₹)</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, i) => {
            const gstRate   = gstRateOf(line);
            const lineTotal = line.taxableValue + line.cgst + line.sgst + line.igst;
            return (
              <tr
                key={line.id}
                className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
              >
                <td className="px-3 py-2 font-medium leading-tight">
                  {line.item.name}
                  {line.item.hsnSac && (
                    <span className="block text-[9px] text-slate-400 font-mono font-normal mt-0.5">
                      HSN: {line.item.hsnSac}
                    </span>
                  )}
                  {line.item.sku && (
                    <span className="block text-[9px] text-slate-400 font-mono font-normal">
                      SKU: {line.item.sku}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-center font-bold">{line.qty}</td>
                <td className="px-2 py-2 text-center text-slate-600">{line.item.unit}</td>
                <td className="px-2 py-2 text-right">₹{line.unitPrice.toFixed(2)}</td>
                <td className="px-2 py-2 text-right">₹{line.taxableValue.toFixed(2)}</td>
                <td className="px-2 py-2 text-center">{gstRate > 0 ? `${gstRate}%` : '—'}</td>
                {hasIgst ? (
                  <td className="px-2 py-2 text-right">₹{line.igst.toFixed(2)}</td>
                ) : (
                  <>
                    <td className="px-2 py-2 text-right">₹{line.cgst.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">₹{line.sgst.toFixed(2)}</td>
                  </>
                )}
                <td className="px-3 py-2 text-right font-semibold">₹{lineTotal.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-800 bg-slate-100 font-bold text-[11px]">
            <td colSpan={4} className="px-3 py-2 text-right text-slate-600">TOTAL</td>
            <td className="px-2 py-2 text-right">₹{invoice.subtotal.toFixed(2)}</td>
            <td className="px-2 py-2 text-center text-slate-400">—</td>
            {hasIgst ? (
              <td className="px-2 py-2 text-right">₹{igstTotal.toFixed(2)}</td>
            ) : (
              <>
                <td className="px-2 py-2 text-right">₹{cgstTotal.toFixed(2)}</td>
                <td className="px-2 py-2 text-right">₹{sgstTotal.toFixed(2)}</td>
              </>
            )}
            <td className="px-3 py-2 text-right">₹{invoice.grandTotal.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      {/* ── Payment info + Summary ── */}
      <div className="flex gap-6 mb-6">

        {/* Left: payment + loyalty */}
        <div className="flex-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Payment Details
          </p>
          <p className="text-[11px] text-slate-700">
            Mode: <span className="font-bold">{invoice.paymentMode}</span>
          </p>

          {invoice.customer && (invoice.rewardPointsEarned > 0 || invoice.rewardPointsRedeemed > 0) && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                {L.loyaltyLedger}
              </p>
              {invoice.rewardPointsEarned > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-600">{L.pointsEarned}</span>
                  <span className="font-bold text-emerald-700">+ {invoice.rewardPointsEarned.toFixed(1)} pts</span>
                </div>
              )}
              {invoice.rewardPointsRedeemed > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-600">{L.pointsRedeemed}</span>
                  <span className="font-bold text-red-600">&#8722; {invoice.rewardPointsRedeemed.toFixed(1)} pts</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: totals summary */}
        <div className="w-72">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-100 text-[11px]">
              <div className="flex justify-between px-4 py-1.5">
                <span className="text-slate-500">{L.subtotal}</span>
                <span>₹{invoice.subtotal.toFixed(2)}</span>
              </div>
              {!hasIgst && cgstTotal > 0 && (
                <div className="flex justify-between px-4 py-1.5">
                  <span className="text-slate-500">{L.cgst}</span>
                  <span>₹{cgstTotal.toFixed(2)}</span>
                </div>
              )}
              {!hasIgst && sgstTotal > 0 && (
                <div className="flex justify-between px-4 py-1.5">
                  <span className="text-slate-500">{L.sgst}</span>
                  <span>₹{sgstTotal.toFixed(2)}</span>
                </div>
              )}
              {hasIgst && igstTotal > 0 && (
                <div className="flex justify-between px-4 py-1.5">
                  <span className="text-slate-500">{L.igst}</span>
                  <span>₹{igstTotal.toFixed(2)}</span>
                </div>
              )}
              {invoice.rewardPointsRedeemed > 0 && (
                <div className="flex justify-between px-4 py-1.5 text-emerald-700 font-semibold">
                  <span>{L.rewardRedeemed}</span>
                  <span>&#8722; ₹{invoice.rewardPointsRedeemed.toFixed(2)}</span>
                </div>
              )}
              <div
                className="flex justify-between px-4 py-3 font-black text-sm text-white"
                style={{ backgroundColor: '#2563eb' }}
              >
                <span>{L.grandTotal}</span>
                <span>₹{invoice.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Notes / Footer ── */}
      <div className="border-t border-slate-200 pt-4 mt-2">
        <p className="text-[10px] text-slate-600 font-semibold italic text-center">
          &#8220;{quote}&#8221;
        </p>
        <p className="text-[10px] text-slate-400 text-center mt-1">{L.computerGenerated}</p>
      </div>

      {/* invisible anchor to force correct column count in tfoot */}
      <span className="hidden">{colCount}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// BILL TEMPLATE — 80mm thermal receipt style
// ══════════════════════════════════════════════════════════════════════════
function BillTemplate({
  invoice,
  storeProfile,
  docLang,
}: {
  invoice: DocumentData;
  storeProfile: StoreProfile;
  docLang: DocLang;
}) {
  const L = getDocLabels(docLang, 'BILL');
  const quote = getFooterQuote(docLang, invoice.invoiceSequence);
  const isTamil = docLang === 'TA';

  const cgstTotal  = invoice.lines.reduce((a, l) => a + l.cgst, 0);
  const sgstTotal  = invoice.lines.reduce((a, l) => a + l.sgst, 0);
  const igstTotal  = invoice.lines.reduce((a, l) => a + l.igst, 0);
  const hasIgst    = igstTotal > 0;
  const totalQty   = invoice.lines.reduce((a, l) => a + l.qty, 0);

  const Hr = ({ dashed }: { dashed?: boolean }) => (
    <div className={`my-1.5 border-t ${dashed ? 'border-dashed border-slate-400' : 'border-slate-800'}`} />
  );

  return (
    <div
      className={`bg-white text-slate-900 max-w-xs mx-auto px-3 py-4 print:max-w-none ${
        isTamil ? 'font-tamil' : 'font-mono'
      } text-[11px] leading-snug`}
    >
      {/* ── Top border + Document title ── */}
      <Hr />
      <p className="text-center font-black text-sm tracking-widest py-0.5">{L.documentTitle}</p>
      <Hr />

      {/* ── Store header ── */}
      <div className="text-center py-2">
        {storeProfile.logoUrl && (
          <img
            src={storeProfile.logoUrl}
            alt={storeProfile.name}
            className="h-16 mx-auto mb-2 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <p className="font-black text-base uppercase tracking-wide">{storeProfile.name}</p>
        {storeProfile.address && (
          <p className="text-[10px] text-slate-600 mt-0.5 whitespace-pre-line leading-relaxed">
            {storeProfile.address}
          </p>
        )}
        {storeProfile.storeMobile && (
          <p className="text-[10px] text-slate-600">Tel: {storeProfile.storeMobile}</p>
        )}
        {storeProfile.storeEmail && (
          <p className="text-[10px] text-slate-600">{storeProfile.storeEmail}</p>
        )}
        {storeProfile.gstNumber && (
          <p className="text-[10px] font-semibold mt-1">GST: {storeProfile.gstNumber}</p>
        )}
      </div>

      <Hr dashed />

      {/* ── Customer info (left) + Bill meta (right) ── */}
      <div className="flex justify-between py-1 text-[10px]">
        <div>
          {invoice.customer ? (
            <>
              <p>
                {L.customer}:{' '}
                <span className="font-bold">{invoice.customer.name || L.walkIn}</span>
              </p>
              <p>
                {L.mobile}: {invoice.customer.mobileNumber}
              </p>
            </>
          ) : (
            <p>
              {L.customer}: <span className="font-bold">{L.walkIn}</span>
            </p>
          )}
        </div>
        <div className="text-right">
          <p>
            {L.documentNo} <span className="font-bold">{invoice.invoiceSequence}</span>
          </p>
          <p>
            {L.date}: {fmtDate(invoice.createdAt)}
          </p>
          <p>
            {L.time}: {fmtTime(invoice.createdAt)}
          </p>
        </div>
      </div>

      <Hr dashed />

      {/* ── Payment mode ── */}
      <div className="flex justify-between py-0.5 text-[10px]">
        <span>{L.paymentMode}</span>
        <span className="font-bold">{invoice.paymentMode}</span>
      </div>

      <Hr dashed />

      {/* ── Items header ── */}
      <div className="flex text-[10px] font-bold pb-1">
        <span className="w-5 shrink-0">Sl.</span>
        <span className="flex-1">{L.item}</span>
        <span className="w-12 text-right">{L.rate}</span>
        <span className="w-8 text-right">{L.qty}</span>
        <span className="w-16 text-right">{L.taxableValue}</span>
      </div>
      <Hr />

      {/* ── Item lines (two-row style) ── */}
      <div className="space-y-1.5 py-1">
        {invoice.lines.map((line, i) => {
          const lineTotal = line.taxableValue + line.cgst + line.sgst + line.igst;
          const gstRate   = gstRateOf(line);
          return (
            <div key={line.id}>
              {/* Row 1: number + item name */}
              <div className="flex text-[10px]">
                <span className="w-5 shrink-0 text-slate-500">{i + 1}</span>
                <span className="flex-1 font-semibold leading-tight">{line.item.name}</span>
              </div>
              {/* Row 2: qty + rate + amount — indented */}
              <div className="flex text-[10px] pl-5">
                <span className="text-slate-500 italic text-[9px] mr-1">
                  {line.qty}{line.item.unit}
                </span>
                <span className="flex-1" />
                <span className="w-12 text-right">{line.unitPrice.toFixed(2)}</span>
                <span className="w-8 text-right">{line.qty}</span>
                <span className="w-16 text-right font-bold">₹{lineTotal.toFixed(2)}</span>
              </div>
              {gstRate > 0 && (
                <div className="text-[9px] text-slate-400 pl-5">
                  {hasIgst
                    ? `${L.igst}: ₹${line.igst.toFixed(2)}`
                    : `${L.cgst}: ₹${line.cgst.toFixed(2)}  ${L.sgst}: ₹${line.sgst.toFixed(2)}`
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Hr />

      {/* ── Item count + qty ── */}
      <div className="flex justify-between text-[10px] font-bold py-0.5">
        <span>Total Item: ({invoice.lines.length})</span>
        <span>Total Qty: ({totalQty})</span>
      </div>

      <Hr dashed />

      {/* ── Totals ── */}
      <div className="space-y-0.5 py-1">
        <div className="flex justify-between text-[10px]">
          <span>Bill Amount</span>
          <span>₹{invoice.grandTotal.toFixed(2)}</span>
        </div>
        {!hasIgst && cgstTotal > 0 && (
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>{L.cgst}</span>
            <span>₹{cgstTotal.toFixed(2)}</span>
          </div>
        )}
        {!hasIgst && sgstTotal > 0 && (
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>{L.sgst}</span>
            <span>₹{sgstTotal.toFixed(2)}</span>
          </div>
        )}
        {hasIgst && igstTotal > 0 && (
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>{L.igst}</span>
            <span>₹{igstTotal.toFixed(2)}</span>
          </div>
        )}
        {invoice.rewardPointsRedeemed > 0 && (
          <div className="flex justify-between text-[10px] text-emerald-700 font-semibold">
            <span>{L.rewardRedeemed}</span>
            <span>&#8722; ₹{invoice.rewardPointsRedeemed.toFixed(2)}</span>
          </div>
        )}
      </div>

      <Hr />

      <div className="flex justify-between font-black text-sm py-1">
        <span>{L.grandTotal}</span>
        <span>₹{invoice.grandTotal.toFixed(2)}</span>
      </div>

      <Hr dashed />

      {/* ── Amount in words ── */}
      {!isTamil && (
        <p className="text-[10px] text-slate-700 italic py-0.5">
          {amountInWords(invoice.grandTotal)}
        </p>
      )}

      {/* ── Loyalty ── */}
      {invoice.customer && (invoice.rewardPointsEarned > 0 || invoice.rewardPointsRedeemed > 0) && (
        <>
          <Hr dashed />
          <div className="py-1 text-[10px]">
            <p className="font-bold mb-0.5">{L.loyaltyLedger}</p>
            {invoice.rewardPointsEarned > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>{L.pointsEarned}</span>
                <span>+ {invoice.rewardPointsEarned.toFixed(1)} pts</span>
              </div>
            )}
            {invoice.rewardPointsRedeemed > 0 && (
              <div className="flex justify-between text-red-600">
                <span>{L.pointsRedeemed}</span>
                <span>&#8722; {invoice.rewardPointsRedeemed.toFixed(1)} pts</span>
              </div>
            )}
          </div>
        </>
      )}

      <Hr dashed />

      {/* ── Footer ── */}
      <div className="text-center py-1 space-y-0.5">
        <p className="font-semibold italic text-[10px]">&#8220;{quote}&#8221;</p>
        <p className="text-[9px] text-slate-400">{L.computerGenerated}</p>
      </div>

      <Hr />
    </div>
  );
}
