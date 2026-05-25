"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { apiClient } from "@/lib/api";

// ── Inline SVG icons ──────────────────────────────────────────────────────
function IcHome() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function IcCart() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6" />
    </svg>
  );
}
function IcBox() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
function IcReceipt() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
function IcUsers() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function IcWallet() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}
function IcSettings() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
function IcSearch() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IcLogout() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function IcBarChart() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}
function IcPackage() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16.5 9.4l-9-5.19" />
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

// ── Nav items ─────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", label: "Dashboard", Icon: IcHome },
  { id: "pos", label: "POS", Icon: IcCart },
  { id: "items", label: "Items", Icon: IcBox },
  { id: "invoices", label: "Invoices", Icon: IcReceipt },
  { id: "customers", label: "Customers", Icon: IcUsers },
  { id: "expenses", label: "Expenses", Icon: IcWallet },
  { id: "stock", label: "Stock", Icon: IcPackage },
  { id: "reports", label: "Reports", Icon: IcBarChart },
  { id: "settings", label: "Config", Icon: IcSettings },
];

type Props = { printHidden?: boolean };

export default function Topbar({ printHidden = false }: Props) {
  const [storeName, setStoreName] = useState("My Store");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [showLogout, setShowLogout] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    apiClient
      .get("/settings/profile")
      .then((r) => {
        const p = r.data?.profile;
        if (p?.name) setStoreName(p.name);
        if (p?.logoUrl) setLogoUrl(p.logoUrl);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showLogout) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-logout-zone]")) setShowLogout(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showLogout]);

  const activeId = NAV.find(
    (n) => pathname === `/${n.id}` || pathname.startsWith(`/${n.id}/`),
  )?.id;

  const handleLogout = () => {
    Cookies.remove("token");
    Cookies.remove("tenantId");
    Cookies.remove("role");
    router.push("/login");
  };

  const initials =
    storeName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "PS";

  return (
    <header
      className={`w-full h-16 shrink-0 flex items-center px-5 gap-4 z-50 ${
        printHidden ? "print:hidden" : ""
      }`}
      style={{
        background: "var(--topbar-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--topbar-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* ── Logo + Store name ── */}
      <div className="flex items-center gap-3 shrink-0 min-w-0 w-52">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="logo"
            className="h-9 w-9 rounded-xl object-cover"
            onError={() => setLogoUrl(null)}
          />
        ) : (
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 font-black text-base text-white"
            style={{ background: "var(--logo-bg)" }}
          >
            {storeName[0]?.toUpperCase() ?? "P"}
          </div>
        )}
        <span className="font-bold text-sm truncate leading-tight my-topbar-text">
          {storeName}
        </span>
      </div>

      {/* ── Nav pills ── */}
      <nav className="flex-1 flex items-center justify-center gap-0.5">
        {NAV.map(({ id, label, Icon }) => {
          const active = activeId === id;
          return (
            <a
              key={id}
              href={`/${id}`}
              title={label}
              className={`relative flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-150 group ${
                active ? "" : "my-nav-inactive"
              }`}
              style={
                active
                  ? {
                      background: "var(--nav-active-bg)",
                      boxShadow: "var(--theme-nav-active-sh)",
                      color: "var(--nav-accent)",
                    }
                  : undefined
              }
            >
              <Icon />
              {/* Tooltip */}
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-semibold bg-black/70 text-white px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {label}
              </span>
              {/* Active indicator dot */}
              {active && (
                <span
                  className="absolute -bottom-[18px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ backgroundColor: "var(--nav-accent)" }}
                />
              )}
            </a>
          );
        })}
      </nav>

      {/* ── Search + Avatar ── */}
      <div className="flex items-center gap-3 shrink-0 w-52 justify-end">
        {/* Search pill */}
        <div
          className="flex items-center gap-2 h-9 px-3 rounded-xl cursor-default select-none my-topbar-muted"
          style={{
            background: "var(--search-bg)",
            border: "1px solid var(--search-border)",
          }}
        >
          <IcSearch />
          <span className="text-xs hidden sm:inline">Search…</span>
        </div>

        {/* Avatar / logout */}
        <div className="relative" data-logout-zone>
          <button
            onClick={() => setShowLogout((v) => !v)}
            className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 transition-transform hover:scale-105 active:scale-95"
            style={{ background: "var(--avatar-bg)" }}
            title="Account"
          >
            {initials}
          </button>

          {showLogout && (
            <div
              className="absolute right-0 top-11 w-44 rounded-2xl overflow-hidden z-50"
              style={{
                background: "var(--dropdown-bg)",
                border: "1px solid var(--border-default)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div
                className="px-4 py-3"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
              >
                <p className="text-xs font-semibold truncate my-dropdown-name">
                  {storeName}
                </p>
                <p className="text-[10px] mt-0.5 my-dropdown-sub">Signed in</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold transition-colors my-dropdown-logout"
              >
                <IcLogout />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
