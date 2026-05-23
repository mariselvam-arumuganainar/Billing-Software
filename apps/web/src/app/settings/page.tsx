'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Topbar from '@/components/Topbar';
import { apiClient } from '@/lib/api';
import { THEMES, getTheme, applyTheme, type ThemeId } from '@/lib/theme';

// ── Indian states ─────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & NH and D&D' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Profile = {
  name: string; address: string; storeMobile: string; storeEmail: string;
  storeWebsite: string; state: string; pincode: string; placeOfSupply: string;
  gstNumber: string; logoUrl: string; loginImageUrl: string; invoiceFooterNote: string;
};

type Settings = {
  rewardConversionRate: string; invoicePrefix: string; billPrefix: string;
  gstEnabled: boolean; allowManualGstEdit: boolean;
  thermalPrintEnabled: boolean; thermalPaperWidth: string;
  thermalPrinterName: string; thermalHeaderText: string; autoPrintAfterCheckout: boolean;
  showLogoOnBill: boolean; showLogoOnInvoice: boolean; compactBillMode: boolean;
  rewardRedemptionEnabled: boolean; creditLimitDefault: string; overdueAlertDays: string;
  enableCash: boolean; enableCard: boolean; enableUpi: boolean;
  enableCredit: boolean; enableSplit: boolean;
};

type Toast = { id: number; type: 'success' | 'error'; text: string };

type ScannerConfig = {
  enabled: boolean;
  name: string;
  suffix: 'Enter' | 'Tab' | 'None';
  autoAddOnExactMatch: boolean;
};

const SCANNER_KEY = 'pss_scanner_config';
const SCANNER_TESTED_KEY = 'pss_scanner_tested_at';

const defaultScanner: ScannerConfig = {
  enabled: true,
  name: '',
  suffix: 'Enter',
  autoAddOnExactMatch: true,
};

const defaultProfile: Profile = {
  name: '', address: '', storeMobile: '', storeEmail: '', storeWebsite: '',
  state: '', pincode: '', placeOfSupply: '', gstNumber: '',
  logoUrl: '', loginImageUrl: '', invoiceFooterNote: '',
};

const defaultSettings: Settings = {
  rewardConversionRate: '0.1', invoicePrefix: 'INV-', billPrefix: 'BILL-',
  gstEnabled: true, allowManualGstEdit: false,
  thermalPrintEnabled: true, thermalPaperWidth: '80mm',
  thermalPrinterName: '', thermalHeaderText: '', autoPrintAfterCheckout: false,
  showLogoOnBill: true, showLogoOnInvoice: true, compactBillMode: false,
  rewardRedemptionEnabled: true, creditLimitDefault: '5000', overdueAlertDays: '30',
  enableCash: true, enableCard: true, enableUpi: true, enableCredit: true, enableSplit: true,
};

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="pb-8" style={{borderBottom:'1px solid var(--theme-divider)'}}>
      <div className="mb-6">
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wide mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-white/35 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl" style={{background:'var(--theme-surface)',border:'1px solid var(--theme-card-border)'}}>
      <div>
        <span className="text-sm font-semibold text-white/85 block">{label}</span>
        {hint && <span className="text-xs text-white/40">{hint}</span>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? '' : 'bg-white/20'}`}
        style={checked ? { background: 'var(--theme-nav-dot)' } : undefined}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function SaveBtn({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <div className="flex justify-end pt-4 mt-6" style={{borderTop:'1px solid var(--theme-divider)'}}>
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="px-6 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98]"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm focus:outline-none text-white placeholder-white/30' +
  ' [background:rgba(255,255,255,0.08)] [border:1px_solid_rgba(255,255,255,0.12)] focus:[background:rgba(255,255,255,0.12)]';
const selectCls = 'w-full px-3 py-2 rounded-lg text-sm focus:outline-none text-white' +
  ' [background:rgba(255,255,255,0.08)] [border:1px_solid_rgba(255,255,255,0.12)] [&>option]:bg-slate-900';

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [thermalTestedAt, setThermalTestedAt] = useState<string | null>(null);
  const [showTestPrint, setShowTestPrint] = useState(false);
  const [activeTheme, setActiveTheme] = useState<ThemeId>('deep-space');
  const [scannerConfig, setScannerConfig] = useState<ScannerConfig>(defaultScanner);
  const [scannerTestedAt, setScannerTestedAt] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState('');
  const testScanRef = useRef<HTMLInputElement>(null);
  const toastId = useRef(0);

  const addToast = useCallback((type: 'success' | 'error', text: string) => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, type, text }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const [profRes, rulesRes] = await Promise.all([
          apiClient.get('/settings/profile'),
          apiClient.get('/settings/rules'),
        ]);
        if (profRes.data.profile) {
          const p = profRes.data.profile;
          setProfile({
            name: p.name || '', address: p.address || '',
            storeMobile: p.storeMobile || '', storeEmail: p.storeEmail || '',
            storeWebsite: p.storeWebsite || '', state: p.state || '',
            pincode: p.pincode || '', placeOfSupply: p.placeOfSupply || '',
            gstNumber: p.gstNumber || '', logoUrl: p.logoUrl || '',
            loginImageUrl: p.loginImageUrl || '', invoiceFooterNote: p.invoiceFooterNote || '',
          });
        }
        if (rulesRes.data.settings) {
          const s = rulesRes.data.settings;
          setSettings({
            rewardConversionRate: String(s.rewardConversionRate ?? '0.1'),
            invoicePrefix: s.invoicePrefix || 'INV-', billPrefix: s.billPrefix || 'BILL-',
            gstEnabled: s.gstEnabled ?? true, allowManualGstEdit: s.allowManualGstEdit ?? false,
            thermalPrintEnabled: s.thermalPrintEnabled ?? true,
            thermalPaperWidth: s.thermalPaperWidth || '80mm',
            thermalPrinterName: s.thermalPrinterName || '', thermalHeaderText: s.thermalHeaderText || '',
            autoPrintAfterCheckout: s.autoPrintAfterCheckout ?? false,
            showLogoOnBill: s.showLogoOnBill ?? true, showLogoOnInvoice: s.showLogoOnInvoice ?? true,
            compactBillMode: s.compactBillMode ?? false,
            rewardRedemptionEnabled: s.rewardRedemptionEnabled ?? true,
            creditLimitDefault: String(s.creditLimitDefault ?? '5000'),
            overdueAlertDays: String(s.overdueAlertDays ?? '30'),
            enableCash: s.enableCash ?? true, enableCard: s.enableCard ?? true,
            enableUpi: s.enableUpi ?? true, enableCredit: s.enableCredit ?? true,
            enableSplit: s.enableSplit ?? true,
          });
        }
        const stored = localStorage.getItem('pss_thermal_tested_at');
        if (stored) setThermalTestedAt(stored);
        const scannerStored = localStorage.getItem(SCANNER_KEY);
        if (scannerStored) {
          try { setScannerConfig(JSON.parse(scannerStored)); } catch { /* ignore malformed */ }
        }
        const scannerTested = localStorage.getItem(SCANNER_TESTED_KEY);
        if (scannerTested) setScannerTestedAt(scannerTested);
        setActiveTheme(getTheme());
      } catch {
        addToast('error', 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [addToast]);

  // ── Save helpers ─────────────────────────────────────────────────────────────

  const run = async (sectionId: string, action: () => Promise<void>) => {
    setSavingSection(sectionId);
    try {
      await action();
      addToast('success', 'Saved successfully');
    } catch (err: any) {
      const msg = err?.response?.data?.details || err?.response?.data?.error || err?.message || 'Failed to save';
      addToast('error', msg);
    } finally {
      setSavingSection(null);
    }
  };

  const profilePayload = () => {
    if (!profile.name.trim()) throw new Error('Store name is required');
    return { ...profile };
  };

  const settingsPayload = () => ({
    ...settings,
    rewardConversionRate: parseFloat(settings.rewardConversionRate || '0'),
    creditLimitDefault: parseFloat(settings.creditLimitDefault || '5000'),
    overdueAlertDays: parseInt(settings.overdueAlertDays || '30'),
  });

  const saveP  = (id: string) => run(id, () => apiClient.put('/settings/profile', profilePayload()));
  const saveS  = (id: string) => run(id, () => apiClient.put('/settings/rules', settingsPayload()));
  const savePS = (id: string) => run(id, async () => {
    const p = profilePayload();
    await Promise.all([
      apiClient.put('/settings/profile', p),
      apiClient.put('/settings/rules', settingsPayload()),
    ]);
  });

  const clearLoginImage = () => run('clear-login', async () => {
    await apiClient.delete('/settings/login-image');
    setProfile(prev => ({ ...prev, loginImageUrl: '' }));
  });

  // ── Thermal test print ───────────────────────────────────────────────────────

  const handleTestPrint = () => {
    const now = new Date().toISOString();
    localStorage.setItem('pss_thermal_tested_at', now);
    setThermalTestedAt(now);
    setShowTestPrint(true);
    setTimeout(() => { window.print(); setShowTestPrint(false); }, 150);
  };

  const getThermalStatus = () => {
    if (!settings.thermalPrintEnabled) return { label: 'DISABLED', cls: 'bg-slate-100 text-slate-500' };
    if (!settings.thermalPrinterName) return { label: 'NOT CONFIGURED', cls: 'bg-amber-100 text-amber-700' };
    if (thermalTestedAt) {
      const mins = Math.round((Date.now() - new Date(thermalTestedAt).getTime()) / 60000);
      const label = mins < 60 ? `TESTED ${mins}m ago` : `TESTED ${Math.round(mins / 60)}h ago`;
      return { label, cls: 'bg-green-100 text-green-700' };
    }
    return { label: 'UNTESTED', cls: 'bg-orange-100 text-orange-700' };
  };

  const saveScanner = () => {
    localStorage.setItem(SCANNER_KEY, JSON.stringify(scannerConfig));
    addToast('success', 'Scanner configuration saved');
  };

  const handleTestScanInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLastScanned(e.target.value);
  };

  const handleTestScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const now = new Date().toISOString();
      localStorage.setItem(SCANNER_TESTED_KEY, now);
      setScannerTestedAt(now);
      // field keeps its value so user can see the scanned barcode
    }
  };

  const getScannerStatus = () => {
    if (!scannerConfig.enabled) return { label: 'DISABLED', cls: 'bg-slate-100 text-slate-500' };
    if (!scannerConfig.name) return { label: 'NOT CONFIGURED', cls: 'bg-amber-100 text-amber-700' };
    if (scannerTestedAt) {
      const mins = Math.round((Date.now() - new Date(scannerTestedAt).getTime()) / 60000);
      const label = mins < 60 ? `TESTED ${mins}m ago` : `TESTED ${Math.round(mins / 60)}h ago`;
      return { label, cls: 'bg-green-100 text-green-700' };
    }
    return { label: 'UNTESTED', cls: 'bg-orange-100 text-orange-700' };
  };

  const isSaving = (id: string) => savingSection === id;
  const thermal  = getThermalStatus();
  const scanner  = getScannerStatus();

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dark-app flex flex-col min-h-screen">
        <Topbar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/40 text-sm">Loading configuration…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hidden test-print receipt */}
      {showTestPrint && (
        <div className="hidden print:block fixed inset-0 bg-white p-6 font-mono text-xs">
          <div className="max-w-xs mx-auto text-center space-y-1">
            <p className="font-bold text-base">{settings.thermalHeaderText || profile.name || 'PSS Store'}</p>
            <p>─────────────────</p>
            <p className="font-bold">*** TEST PRINT ***</p>
            <p>{new Date().toLocaleString('en-IN')}</p>
            <p>─────────────────</p>
            <p>Printer: {settings.thermalPrinterName || '(not set)'}</p>
            <p>Paper: {settings.thermalPaperWidth}</p>
            <p>─────────────────</p>
            <p>Printing works!</p>
          </div>
        </div>
      )}

      <div className="dark-app flex flex-col min-h-screen print:hidden">
        <Topbar />

        {/* Toast stack */}
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium border ${
              t.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {t.type === 'success' ? '✓ ' : '✕ '}{t.text}
            </div>
          ))}
        </div>

        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="px-8 h-14 flex items-center shrink-0" style={{borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
            <h2 className="text-lg font-bold text-white">Configuration</h2>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-8 space-y-6">

              {/* 1. Store Profile */}
              <SectionCard title="Store Profile" subtitle="Basic information shown on bills and invoices">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Field label="Store Name" hint="Required — appears on all printed documents">
                      <input className={inputCls} value={profile.name}
                        onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="PSS Store" />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Address">
                      <textarea className={inputCls} rows={3} value={profile.address}
                        onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
                        placeholder="123 Retail Lane, Bengaluru – 560001" />
                    </Field>
                  </div>
                  <Field label="State">
                    <select className={selectCls} value={profile.state}
                      onChange={e => setProfile(p => ({ ...p, state: e.target.value }))}>
                      <option value="">Select state</option>
                      {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.code} – {s.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Pincode">
                    <input className={inputCls} value={profile.pincode} maxLength={6}
                      onChange={e => setProfile(p => ({ ...p, pincode: e.target.value }))} placeholder="560001" />
                  </Field>
                  <Field label="Mobile Number">
                    <input className={inputCls} type="tel" value={profile.storeMobile}
                      onChange={e => setProfile(p => ({ ...p, storeMobile: e.target.value }))}
                      placeholder="+91 98765 43210" />
                  </Field>
                  <Field label="Email">
                    <input className={inputCls} type="email" value={profile.storeEmail}
                      onChange={e => setProfile(p => ({ ...p, storeEmail: e.target.value }))}
                      placeholder="store@example.com" />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Website">
                      <input className={inputCls} type="url" value={profile.storeWebsite}
                        onChange={e => setProfile(p => ({ ...p, storeWebsite: e.target.value }))}
                        placeholder="https://yourstore.com" />
                    </Field>
                  </div>
                </div>
                <SaveBtn saving={isSaving('store-profile')} onSave={() => saveP('store-profile')} />
              </SectionCard>

              {/* 2. Tax & GST */}
              <SectionCard title="Tax & GST" subtitle="GST registration and tax calculation rules">
                <div className="space-y-4">
                  <Field label="GSTIN" hint="15-character GST Identification Number">
                    <input className={inputCls} value={profile.gstNumber} maxLength={15}
                      onChange={e => setProfile(p => ({ ...p, gstNumber: e.target.value.toUpperCase() }))}
                      placeholder="29AAAAA1111A1Z1" />
                  </Field>
                  <Field label="Place of Supply" hint="Determines CGST+SGST (intrastate) vs IGST (interstate)">
                    <select className={selectCls} value={profile.placeOfSupply}
                      onChange={e => setProfile(p => ({ ...p, placeOfSupply: e.target.value }))}>
                      <option value="">Select place of supply</option>
                      {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.code} – {s.name}</option>)}
                    </select>
                  </Field>
                  <Toggle checked={settings.gstEnabled}
                    onChange={v => setSettings(s => ({ ...s, gstEnabled: v }))}
                    label="GST Enabled"
                    hint="Disabling hides all tax breakdowns on bills and invoices" />
                  <Toggle checked={settings.allowManualGstEdit}
                    onChange={v => setSettings(s => ({ ...s, allowManualGstEdit: v }))}
                    label="Allow Manual GST Override at POS"
                    hint="Lets cashiers change the GST rate per line item during checkout" />
                </div>
                <SaveBtn saving={isSaving('tax-gst')} onSave={() => savePS('tax-gst')} />
              </SectionCard>

              {/* 3. Branding */}
              <SectionCard title="Branding" subtitle="Logo, login page, and document appearance">
                <div className="space-y-5">
                  <Field label="Store Logo URL" hint="Shown on invoices and bills when logo display is enabled">
                    <input className={inputCls} value={profile.logoUrl}
                      onChange={e => setProfile(p => ({ ...p, logoUrl: e.target.value }))}
                      placeholder="https://example.com/logo.png" />
                    {profile.logoUrl && (
                      <div className="mt-2 h-16 w-32 rounded-lg overflow-hidden" style={{border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)'}}>
                        <img src={profile.logoUrl} alt="Logo preview"
                          className="w-full h-full object-contain p-1"
                          onError={e => (e.currentTarget.style.display = 'none')} />
                      </div>
                    )}
                  </Field>
                  <Field label="Login Page Illustration URL" hint="Custom image on the login screen. Leave blank for the default gradient.">
                    <div className="flex gap-2">
                      <input className={inputCls} value={profile.loginImageUrl}
                        onChange={e => setProfile(p => ({ ...p, loginImageUrl: e.target.value }))}
                        placeholder="https://example.com/illustration.png" />
                      {profile.loginImageUrl && (
                        <button type="button" disabled={isSaving('clear-login')} onClick={clearLoginImage}
                          className="px-3 py-2 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 whitespace-nowrap shrink-0">
                          {isSaving('clear-login') ? '…' : 'Clear'}
                        </button>
                      )}
                    </div>
                    {profile.loginImageUrl && (
                      <div className="mt-2 h-20 w-36 rounded-lg overflow-hidden" style={{border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)'}}>
                        <img src={profile.loginImageUrl} alt="Login preview"
                          className="w-full h-full object-cover"
                          onError={e => (e.currentTarget.style.display = 'none')} />
                      </div>
                    )}
                  </Field>
                  <div className="space-y-2">
                    <Toggle checked={settings.showLogoOnBill}
                      onChange={v => setSettings(s => ({ ...s, showLogoOnBill: v }))}
                      label="Show Logo on Thermal Bill" />
                    <Toggle checked={settings.showLogoOnInvoice}
                      onChange={v => setSettings(s => ({ ...s, showLogoOnInvoice: v }))}
                      label="Show Logo on Tax Invoice" />
                    <Toggle checked={settings.compactBillMode}
                      onChange={v => setSettings(s => ({ ...s, compactBillMode: v }))}
                      label="Compact Bill Mode"
                      hint="Removes blank lines and summary totals — for high-volume counters" />
                  </div>
                  <Field label="Invoice Footer Note" hint="Printed at the bottom of every invoice">
                    <textarea className={inputCls} rows={2} value={profile.invoiceFooterNote}
                      onChange={e => setProfile(p => ({ ...p, invoiceFooterNote: e.target.value }))}
                      placeholder="Thank you for shopping with us! Goods once sold cannot be returned." />
                  </Field>
                </div>
                <SaveBtn saving={isSaving('branding')} onSave={() => savePS('branding')} />
              </SectionCard>

              {/* 4. Invoice & Numbering */}
              <SectionCard title="Invoice & Numbering" subtitle="Prefixes for tax invoice and thermal bill numbers">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Invoice Prefix" hint="e.g. INV-2025-001">
                    <input className={inputCls} value={settings.invoicePrefix}
                      onChange={e => setSettings(s => ({ ...s, invoicePrefix: e.target.value }))}
                      placeholder="INV-" />
                  </Field>
                  <Field label="Bill Prefix" hint="e.g. BILL-2025-001">
                    <input className={inputCls} value={settings.billPrefix}
                      onChange={e => setSettings(s => ({ ...s, billPrefix: e.target.value }))}
                      placeholder="BILL-" />
                  </Field>
                </div>
                <SaveBtn saving={isSaving('numbering')} onSave={() => saveS('numbering')} />
              </SectionCard>

              {/* 5. Reward & Loyalty */}
              <SectionCard title="Reward & Loyalty" subtitle="Point earning rate, redemption, and credit defaults">
                <div className="space-y-4">
                  <Field label="Global Reward Rate" hint="Points earned per ₹1 spent. Customer-specific rates override this. (e.g. 0.1 = 1 pt per ₹10)">
                    <div className="flex items-center gap-2">
                      <input className={inputCls} type="number" step="0.01" min="0" max="1"
                        value={settings.rewardConversionRate}
                        onChange={e => setSettings(s => ({ ...s, rewardConversionRate: e.target.value }))}
                        placeholder="0.1" />
                      <span className="text-sm text-slate-500 whitespace-nowrap">pts / ₹1</span>
                    </div>
                  </Field>
                  <Toggle checked={settings.rewardRedemptionEnabled}
                    onChange={v => setSettings(s => ({ ...s, rewardRedemptionEnabled: v }))}
                    label="Allow Reward Redemption at POS"
                    hint="If disabled, points accumulate but cannot be spent" />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Default Credit Limit (₹)" hint="Applied when a new credit account is created">
                      <input className={inputCls} type="number" min="0"
                        value={settings.creditLimitDefault}
                        onChange={e => setSettings(s => ({ ...s, creditLimitDefault: e.target.value }))}
                        placeholder="5000" />
                    </Field>
                    <Field label="Overdue Alert (days)" hint="Flag credit accounts overdue beyond this many days">
                      <input className={inputCls} type="number" min="1"
                        value={settings.overdueAlertDays}
                        onChange={e => setSettings(s => ({ ...s, overdueAlertDays: e.target.value }))}
                        placeholder="30" />
                    </Field>
                  </div>
                </div>
                <SaveBtn saving={isSaving('rewards')} onSave={() => saveS('rewards')} />
              </SectionCard>

              {/* 6. Payment Methods */}
              <SectionCard title="Payment Methods" subtitle="Toggle which modes appear at checkout">
                <div className="space-y-2">
                  <Toggle checked={settings.enableCash} onChange={v => setSettings(s => ({ ...s, enableCash: v }))} label="Cash" />
                  <Toggle checked={settings.enableCard} onChange={v => setSettings(s => ({ ...s, enableCard: v }))} label="Card (Debit / Credit)" />
                  <Toggle checked={settings.enableUpi} onChange={v => setSettings(s => ({ ...s, enableUpi: v }))} label="UPI" />
                  <Toggle checked={settings.enableCredit}
                    onChange={v => setSettings(s => ({ ...s, enableCredit: v }))}
                    label="Credit Account"
                    hint="Customer buys on credit — requires an active CreditAccount" />
                  <Toggle checked={settings.enableSplit}
                    onChange={v => setSettings(s => ({ ...s, enableSplit: v }))}
                    label="Split Payment"
                    hint="Partial cash + UPI or card" />
                </div>
                <SaveBtn saving={isSaving('payments')} onSave={() => saveS('payments')} />
              </SectionCard>

              {/* 7. Thermal Printer */}
              <SectionCard title="Thermal Printer" subtitle="Receipt printing configuration">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-sm font-semibold text-slate-600">Status:</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${thermal.cls}`}>
                    {thermal.label}
                  </span>
                </div>
                <div className="space-y-4">
                  <Toggle checked={settings.thermalPrintEnabled}
                    onChange={v => setSettings(s => ({ ...s, thermalPrintEnabled: v }))}
                    label="Enable Thermal Printing"
                    hint="Enables the browser print dialog for thermal receipts" />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Paper Width">
                      <select className={selectCls} value={settings.thermalPaperWidth}
                        onChange={e => setSettings(s => ({ ...s, thermalPaperWidth: e.target.value }))}>
                        <option value="80mm">80mm (standard)</option>
                        <option value="58mm">58mm (compact)</option>
                      </select>
                    </Field>
                    <Field label="Printer Name / Queue" hint="For your reference only">
                      <input className={inputCls} value={settings.thermalPrinterName}
                        onChange={e => setSettings(s => ({ ...s, thermalPrinterName: e.target.value }))}
                        placeholder="EPSON-T20" />
                    </Field>
                  </div>
                  <Field label="Thermal Header Text" hint={`First line on every receipt (default: "${profile.name || 'PSS Store'}")`}>
                    <input className={inputCls} value={settings.thermalHeaderText}
                      onChange={e => setSettings(s => ({ ...s, thermalHeaderText: e.target.value }))}
                      placeholder={profile.name || 'PSS Store'} />
                  </Field>
                  <Toggle checked={settings.autoPrintAfterCheckout}
                    onChange={v => setSettings(s => ({ ...s, autoPrintAfterCheckout: v }))}
                    label="Auto-print After Checkout"
                    hint="Immediately triggers the print dialog on successful payment" />
                </div>
                <div className="flex items-center justify-between pt-4 mt-6" style={{borderTop:'1px solid rgba(255,255,255,0.07)'}}>
                  <button type="button" onClick={handleTestPrint}
                    disabled={!settings.thermalPrintEnabled}
                    className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    style={{border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.6)'}}>
                    Send Test Print
                  </button>
                  <button type="button" disabled={isSaving('thermal')} onClick={() => saveS('thermal')}
                    className="px-6 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98]">
                    {isSaving('thermal') ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </SectionCard>

              {/* 8. Barcode Scanner */}
              <SectionCard title="Barcode Scanner" subtitle="USB or Bluetooth keyboard-wedge barcode reader settings">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-sm font-semibold text-slate-600">Status:</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${scanner.cls}`}>
                    {scanner.label}
                  </span>
                </div>

                <div className="space-y-4">
                  <Toggle
                    checked={scannerConfig.enabled}
                    onChange={v => setScannerConfig(c => ({ ...c, enabled: v }))}
                    label="Barcode Scanner Enabled"
                    hint="Enables barcode-based item lookup in Item Master and POS billing"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Scanner Model / Name" hint="For your reference only — e.g. Zebra LS2208">
                      <input
                        className={inputCls}
                        value={scannerConfig.name}
                        onChange={e => setScannerConfig(c => ({ ...c, name: e.target.value }))}
                        placeholder="e.g. Zebra LS2208"
                      />
                    </Field>

                    <Field label="Scan Suffix" hint="Character the scanner sends after each barcode">
                      <select
                        className={selectCls}
                        value={scannerConfig.suffix}
                        onChange={e => setScannerConfig(c => ({ ...c, suffix: e.target.value as ScannerConfig['suffix'] }))}
                      >
                        <option value="Enter">Enter (most scanners)</option>
                        <option value="Tab">Tab</option>
                        <option value="None">None (suffix disabled)</option>
                      </select>
                    </Field>
                  </div>

                  <Toggle
                    checked={scannerConfig.autoAddOnExactMatch}
                    onChange={v => setScannerConfig(c => ({ ...c, autoAddOnExactMatch: v }))}
                    label="Auto-add to Cart on Exact Barcode Match"
                    hint="When POS search returns exactly 1 item matching the barcode, add it to cart automatically on scan"
                  />

                  {/* How it works notice */}
                  <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
                    <svg className="w-4 h-4 shrink-0 mt-0.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs text-white/50 leading-relaxed">
                      <span className="text-white/70 font-semibold block mb-0.5">How scanner integration works</span>
                      USB and Bluetooth barcode scanners act as keyboard devices. When you scan a product, the decoded barcode value is typed into the active field followed by the suffix key (usually Enter). In POS billing, keep focus on the search box — the scanner fills it and the suffix triggers the add-to-cart action automatically.
                    </div>
                  </div>

                  {/* Test scan field */}
                  <Field label="Test Scan" hint="Click the field below, then scan any barcode to verify your scanner is working">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h1M4 17v2a1 1 0 001 1h1M19 5h-1a1 1 0 00-1 1v2M19 19h-1a1 1 0 01-1-1v-2M8 5v14M12 5v14M16 5v14" />
                        </svg>
                      </div>
                      <input
                        ref={testScanRef}
                        type="text"
                        value={lastScanned}
                        onChange={handleTestScanInput}
                        onKeyDown={handleTestScanKeyDown}
                        className={`${inputCls} pl-9 font-mono`}
                        placeholder="Click here and scan a barcode…"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {lastScanned && (
                        <button
                          type="button"
                          onClick={() => setLastScanned('')}
                          className="absolute inset-y-0 right-3 flex items-center text-white/30 hover:text-white/60"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {lastScanned && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                        <span className="text-green-400 font-semibold">Scanner working —</span>
                        <span className="text-white/50">captured: </span>
                        <span className="font-mono text-white/80">{lastScanned}</span>
                        <span className="text-white/35">({lastScanned.length} chars)</span>
                      </div>
                    )}
                  </Field>
                </div>

                <div className="flex items-center justify-between pt-4 mt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-xs text-white/30">Scanner settings are saved to this device only.</p>
                  <button
                    type="button"
                    onClick={saveScanner}
                    className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98]"
                  >
                    Save Changes
                  </button>
                </div>
              </SectionCard>

              {/* 9. Appearance */}
              <SectionCard title="Appearance" subtitle="Choose a theme for the application interface">
                <div className="grid grid-cols-3 gap-4">
                  {THEMES.map(theme => {
                    const selected = activeTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => {
                          setActiveTheme(theme.id);
                          applyTheme(theme.id);
                        }}
                        className="relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 text-left group"
                        style={{
                          border: selected
                            ? `2px solid ${theme.accent}`
                            : '2px solid rgba(255,255,255,0.10)',
                          boxShadow: selected
                            ? `0 0 0 1px ${theme.accent}40, 0 4px 20px rgba(0,0,0,0.3)`
                            : '0 2px 8px rgba(0,0,0,0.2)',
                        }}
                      >
                        {/* Preview swatch */}
                        <div
                          className="h-24 w-full relative overflow-hidden"
                          style={{ background: theme.gradient }}
                        >
                          {/* Mock topbar */}
                          <div
                            className="absolute top-0 inset-x-0 h-6 flex items-center px-2 gap-1"
                            style={{ background: 'rgba(0,0,0,0.25)', borderBottom: `1px solid ${theme.border}` }}
                          >
                            <div className="w-3 h-3 rounded-full" style={{ background: theme.accent + 'cc' }} />
                            <div className="flex-1 flex justify-center gap-1">
                              {[0,1,2,3].map(i => (
                                <div key={i} className="w-4 h-2 rounded-sm" style={{ background: 'rgba(255,255,255,0.15)' }} />
                              ))}
                            </div>
                          </div>
                          {/* Mock content */}
                          <div className="absolute inset-x-2 top-8 space-y-1.5">
                            <div className="flex gap-1.5">
                              <div className="h-6 flex-1 rounded" style={{ background: theme.surface }} />
                              <div className="h-6 flex-1 rounded" style={{ background: theme.surface }} />
                              <div className="h-6 w-8 rounded" style={{ background: theme.accent + '33' }} />
                            </div>
                            <div className="h-5 rounded" style={{ background: theme.surface }} />
                            <div className="flex items-center gap-1">
                              <div className="h-3 w-14 rounded-full" style={{ background: theme.accent }} />
                              <div className="h-3 flex-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                            </div>
                          </div>
                        </div>

                        {/* Label */}
                        <div className="px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-white leading-tight">{theme.name}</p>
                              <p className="text-xs text-white/45 mt-0.5">{theme.description}</p>
                            </div>
                            {selected && (
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                style={{ background: theme.accent }}
                              >
                                ✓
                              </span>
                            )}
                          </div>
                          {/* Accent color swatch strip */}
                          <div className="mt-2 flex gap-1">
                            <div className="h-1.5 flex-1 rounded-full" style={{ background: theme.accent }} />
                            <div className="h-1.5 flex-1 rounded-full" style={{ background: theme.surface }} />
                            <div className="h-1.5 w-6 rounded-full" style={{ background: theme.border }} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-white/35 mt-4">
                  Theme is applied instantly and saved to this browser. No server save needed.
                </p>
              </SectionCard>

              <div className="h-8" />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
