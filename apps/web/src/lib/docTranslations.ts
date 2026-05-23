// ── Bilingual document system ──────────────────────────────────────────────
// Supports English (EN) and Tamil (TA) for both BILL and INVOICE types.
// Footer quotes rotate deterministically per invoice so every document
// gets a unique but reproducible quote.

export type DocLang = 'EN' | 'TA';
export type DocType = 'BILL' | 'INVOICE';

export const LANG_DISPLAY: Record<DocLang, string> = { EN: 'English', TA: 'Tamil' };
export const DTYPE_DISPLAY: Record<DocType, string> = { BILL: 'Bill', INVOICE: 'Tax Invoice' };

// ── Label set for one (lang × docType) combination ────────────────────────
export type DocLabels = {
  documentTitle: string;
  documentNo: string;
  date: string;
  time: string;
  customer: string;
  mobile: string;
  paymentMode: string;
  item: string;
  qty: string;
  unit: string;
  rate: string;
  taxableValue: string;
  gstRate: string;
  cgst: string;
  sgst: string;
  igst: string;
  totalTax: string;
  subtotal: string;
  rewardRedeemed: string;
  grandTotal: string;
  pointsEarned: string;
  pointsRedeemed: string;
  walkIn: string;
  hsnSac: string;
  gstin: string;
  loyaltyLedger: string;
  computerGenerated: string;
};

// ── All translations ───────────────────────────────────────────────────────
const T: Record<DocLang, Record<DocType, DocLabels>> = {
  EN: {
    BILL: {
      documentTitle:    'BILL OF SUPPLY',
      documentNo:       'Bill No.',
      date:             'Date',
      time:             'Time',
      customer:         'Customer',
      mobile:           'Mobile',
      paymentMode:      'Payment',
      item:             'Item',
      qty:              'Qty',
      unit:             'Unit',
      rate:             'Rate',
      taxableValue:     'Amount',
      gstRate:          'GST%',
      cgst:             'CGST',
      sgst:             'SGST',
      igst:             'IGST',
      totalTax:         'Total Tax',
      subtotal:         'Subtotal',
      rewardRedeemed:   'Reward Disc.',
      grandTotal:       'Net Payable',
      pointsEarned:     'Points Earned',
      pointsRedeemed:   'Points Used',
      walkIn:           'Walk-In Customer',
      hsnSac:           'HSN/SAC',
      gstin:            'GSTIN',
      loyaltyLedger:    'Loyalty Rewards',
      computerGenerated:'Computer generated. No signature required.',
    },
    INVOICE: {
      documentTitle:    'TAX INVOICE',
      documentNo:       'Invoice No.',
      date:             'Date',
      time:             'Time',
      customer:         'Bill To',
      mobile:           'Mobile',
      paymentMode:      'Payment Mode',
      item:             'Item / Description',
      qty:              'Qty',
      unit:             'Unit',
      rate:             'Rate (₹)',
      taxableValue:     'Taxable Value',
      gstRate:          'GST %',
      cgst:             'CGST (₹)',
      sgst:             'SGST (₹)',
      igst:             'IGST (₹)',
      totalTax:         'Total Tax',
      subtotal:         'Taxable Amount',
      rewardRedeemed:   'Reward Redemption',
      grandTotal:       'Net Payable',
      pointsEarned:     'Points Earned',
      pointsRedeemed:   'Points Redeemed',
      walkIn:           'Walk-In / Cash Customer',
      hsnSac:           'HSN / SAC',
      gstin:            'GSTIN',
      loyaltyLedger:    'Loyalty Rewards Summary',
      computerGenerated:'Computer generated invoice. No signature required.',
    },
  },
  TA: {
    BILL: {
      documentTitle:    'சப்ளை பில்',
      documentNo:       'பில் எண்.',
      date:             'தேதி',
      time:             'நேரம்',
      customer:         'வாடிக்கையாளர்',
      mobile:           'தொலைபேசி',
      paymentMode:      'கட்டணம்',
      item:             'பொருள்',
      qty:              'அளவு',
      unit:             'அலகு',
      rate:             'விலை',
      taxableValue:     'தொகை',
      gstRate:          'GST%',
      cgst:             'CGST',
      sgst:             'SGST',
      igst:             'IGST',
      totalTax:         'மொத்த வரி',
      subtotal:         'மொத்தம்',
      rewardRedeemed:   'வெகுமதி தள்ளுபடி',
      grandTotal:       'செலுத்த வேண்டியது',
      pointsEarned:     'பெறப்பட்ட புள்ளிகள்',
      pointsRedeemed:   'பயன்படுத்திய புள்ளிகள்',
      walkIn:           'நேரடி வாடிக்கையாளர்',
      hsnSac:           'HSN/SAC',
      gstin:            'GSTIN',
      loyaltyLedger:    'வெகுமதி புள்ளிகள்',
      computerGenerated:'கணினி உருவாக்கிய பில். கையெழுத்து தேவையில்லை.',
    },
    INVOICE: {
      documentTitle:    'வரி இன்வாய்ஸ்',
      documentNo:       'இன்வாய்ஸ் எண்.',
      date:             'தேதி',
      time:             'நேரம்',
      customer:         'பில் பெறுபவர்',
      mobile:           'அலைபேசி',
      paymentMode:      'கட்டண முறை',
      item:             'பொருள் / விவரம்',
      qty:              'அளவு',
      unit:             'அலகு',
      rate:             'விலை (₹)',
      taxableValue:     'வரி விதிக்கக்கூடிய மதிப்பு',
      gstRate:          'GST %',
      cgst:             'CGST (₹)',
      sgst:             'SGST (₹)',
      igst:             'IGST (₹)',
      totalTax:         'மொத்த வரி',
      subtotal:         'வரி விதிக்கக்கூடிய தொகை',
      rewardRedeemed:   'வெகுமதி பயன்பாடு',
      grandTotal:       'செலுத்த வேண்டிய தொகை',
      pointsEarned:     'பெறப்பட்ட புள்ளிகள்',
      pointsRedeemed:   'பயன்படுத்திய புள்ளிகள்',
      walkIn:           'நேரடி / பண வாடிக்கையாளர்',
      hsnSac:           'HSN / SAC',
      gstin:            'GSTIN',
      loyaltyLedger:    'வெகுமதி புள்ளிகள் சுருக்கம்',
      computerGenerated:'கணினி உருவாக்கிய இன்வாய்ஸ். கையெழுத்து தேவையில்லை.',
    },
  },
};

export function getDocLabels(lang: DocLang, docType: DocType): DocLabels {
  return T[lang][docType];
}

// ── Rotating footer quotes ─────────────────────────────────────────────────
// Each invoice gets a deterministic quote based on its sequence string,
// so the same invoice always shows the same quote across reprints.
const QUOTES: Record<DocLang, string[]> = {
  EN: [
    'Thank you for shopping with us!',
    'Your satisfaction is our highest priority. Visit again!',
    'Quality products, trusted service — always.',
    'We value your business. Come back soon!',
    'Every purchase is appreciated. Thank you!',
    'Great shopping experience guaranteed. Thank you!',
    'Your trust means everything to us. Thank you!',
    'We look forward to serving you again!',
  ],
  TA: [
    'எங்களிடம் வாங்கியதற்கு நன்றி!',
    'உங்கள் திருப்தியே எங்கள் முன்னுரிமை. மீண்டும் வாருங்கள்!',
    'தரமான பொருட்கள், நம்பகமான சேவை — எப்போதும்.',
    'உங்கள் ஆதரவிற்கு நன்றி. விரைவில் வாருங்கள்!',
    'ஒவ்வொரு கொள்முதலும் மதிப்பானது. நன்றி!',
    'சிறந்த வணிக அனுபவம் உறுதி. நன்றி!',
    'உங்கள் நம்பிக்கை எங்களுக்கு மிகவும் மதிப்பானது. நன்றி!',
    'மீண்டும் உங்களுக்கு சேவை செய்ய ஆவலுடன் காத்திருக்கிறோம்!',
  ],
};

export function getFooterQuote(lang: DocLang, invoiceSequence: string): string {
  const list = QUOTES[lang];
  let h = 0;
  for (let i = 0; i < invoiceSequence.length; i++) {
    h = (h * 31 + invoiceSequence.charCodeAt(i)) & 0x7fffffff;
  }
  return list[h % list.length];
}

// ── Document metadata — stored in localStorage for Phase 1 ────────────────
// Keyed by invoiceId. Phase 2: move to DB column.

const META_KEY = 'pss_doc_meta';

export type DocMeta = {
  docType: DocType;
  docLang: DocLang;
  generatedAt: string;
};

export function saveDocMeta(invoiceId: string, meta: DocMeta): void {
  try {
    const raw = localStorage.getItem(META_KEY);
    const data: Record<string, DocMeta> = raw ? JSON.parse(raw) : {};
    data[invoiceId] = meta;
    localStorage.setItem(META_KEY, JSON.stringify(data));
  } catch { /* ignore storage errors */ }
}

export function loadDocMeta(invoiceId: string): DocMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    const data: Record<string, DocMeta> = JSON.parse(raw);
    return data[invoiceId] ?? null;
  } catch { return null; }
}

export function loadAllDocMeta(): Record<string, DocMeta> {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
