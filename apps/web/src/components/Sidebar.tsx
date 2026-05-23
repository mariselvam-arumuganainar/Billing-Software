'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { apiClient } from '@/lib/api';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'pos', label: 'POS Billing', icon: '🛒' },
  { id: 'items', label: 'Item Master', icon: '📦' },
  { id: 'invoices', label: 'Invoices', icon: '🧾' },
  { id: 'customers', label: 'Customers', icon: '👥' },
  { id: 'expenses', label: 'Expenses', icon: '💸' },
  { id: 'settings', label: 'Configuration', icon: '⚙️' },
];

type Props = {
  subtitle?: string;
  printHidden?: boolean;
};

export default function Sidebar({ subtitle, printHidden = false }: Props) {
  const [storeName, setStoreName] = useState('PSS Store');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    apiClient.get('/settings/profile')
      .then(r => {
        const p = r.data?.profile;
        if (p?.name) setStoreName(p.name);
        if (p?.logoUrl) setLogoUrl(p.logoUrl);
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    Cookies.remove('token');
    Cookies.remove('tenantId');
    Cookies.remove('role');
    router.push('/login');
  };

  const activeId = NAV_ITEMS.find(
    item => pathname === `/${item.id}` || pathname.startsWith(`/${item.id}/`)
  )?.id;

  return (
    <aside
      className={`w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20 shrink-0 ${
        printHidden ? 'print:hidden' : ''
      }`}
    >
      {/* Store identity */}
      <div className="p-5 border-b border-slate-800">
        {logoUrl ? (
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt="logo"
              className="h-10 w-10 rounded-xl object-contain bg-white/10 p-1 shrink-0"
              onError={() => setLogoUrl(null)}
            />
            <div className="min-w-0">
              <p className="text-base font-bold text-white truncate leading-tight">{storeName}</p>
              {subtitle && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-black text-transparent bg-clip-text bg-linear-to-r from-teal-400 to-emerald-400 truncate">
              {storeName}
            </h1>
            {subtitle && (
              <p className="text-xs text-slate-400 font-medium tracking-wide mt-0.5 uppercase">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 mt-3 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <a
            key={item.id}
            href={`/${item.id}`}
            className={`flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-150 ${
              activeId === item.id
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="mr-3 text-lg leading-none">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
        >
          <span className="mr-2">🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
