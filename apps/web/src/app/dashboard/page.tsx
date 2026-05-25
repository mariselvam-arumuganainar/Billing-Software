"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { apiClient } from "@/lib/api";
import Topbar from "@/components/Topbar";

// ── Types ─────────────────────────────────────────────────────────────────
type MetricSet      = { sales: number; gst: number; expenses: number; creditDue: number; rewardPoints: number };
type TopItem        = { name: string; qty: number; rev: number };
type ReportSummary  = { grossSales: number; netSales: number; taxCollected: number; expensesTotal: number; profitEstimate: number; invoiceCount?: number };
type Invoice        = { id: string; invoiceSequence: string; grandTotal: number; paymentMode: "CASH"|"CARD"|"UPI"|"CREDIT"|"SPLIT"; status: string; createdAt: string; customer?: { name?: string; mobileNumber?: string } };
type LowStockItem   = { id: string; name: string; stockQty: number; unit: string; sku?: string };
type PayEntry       = { key: string; value: number; pct: number; color: string };
type ChartPoint     = { label: string; sales: number; expenses: number; net: number };

// ── Semantic colour tokens ─────────────────────────────────────────────────
const C = {
  sales:    { from: "#f97316", to: "#fbbf24", glow: "rgba(249,115,22,0.25)",  text: "#fb923c" },
  profit:   { from: "#10b981", to: "#34d399", glow: "rgba(16,185,129,0.25)",  text: "#34d399" },
  gst:      { from: "#0ea5e9", to: "#38bdf8", glow: "rgba(14,165,233,0.25)",  text: "#38bdf8" },
  expenses: { from: "#f59e0b", to: "#fbbf24", glow: "rgba(245,158,11,0.25)",  text: "#fbbf24" },
  credit:   { from: "#f43f5e", to: "#fb7185", glow: "rgba(244,63,94,0.25)",   text: "#fb7185" },
};

const MODE_COLOR: Record<string, string> = {
  CASH:   "#10b981",
  CARD:   "#3b82f6",
  UPI:    "#8b5cf6",
  CREDIT: "#f43f5e",
  SPLIT:  "#f59e0b",
};

// ── Formatters ────────────────────────────────────────────────────────────
function fmtShort(v: number) {
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000)      return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}
function fmtFull(v: number) {
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ── SVG Dual Bar Chart ────────────────────────────────────────────────────
function BarChart({ data }: { data: ChartPoint[] }) {
  const W = 560; const H = 180; const pX = 46; const pY = 24;
  const innerW = W - pX * 2; const innerH = H - pY;
  const maxVal = Math.max(...data.flatMap(d => [d.sales, d.expenses]), 1);
  const step = innerW / data.length;
  // Each group has 2 bars with a small gap between them
  const bW = Math.floor(step * 0.28);
  const gap = Math.floor(step * 0.05);

  const grids = [0.25, 0.5, 0.75, 1].map(f => ({
    y: pY + innerH - f * innerH,
    label: fmtShort(maxVal * f),
  }));

  function getSalesX(i: number) { return pX + i * step + (step - bW * 2 - gap) / 2; }
  function getExpX(i: number)   { return getSalesX(i) + bW + gap; }
  function barH(v: number)      { return Math.max((v / maxVal) * innerH, v > 0 ? 3 : 0); }

  const lastIdx = data.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full h-[200px]" style={{ overflow: "visible" }}>
      <defs>
        {data.map((_, i) => (
          <linearGradient key={`s-${i}`} id={`s-${i}`} x1="0" y1="0" x2="0" y2="1">
            {i === lastIdx
              ? <><stop offset="0%" stopColor="#f97316"/><stop offset="100%" stopColor="#ef4444"/></>
              : <><stop offset="0%" stopColor="#4361EE" stopOpacity="0.85"/><stop offset="100%" stopColor="#3451D1" stopOpacity="0.55"/></>
            }
          </linearGradient>
        ))}
      </defs>

      {/* Grid */}
      {grids.map((g, i) => (
        <g key={i}>
          <line x1={pX} y1={g.y} x2={W - pX} y2={g.y} stroke="rgba(0,0,0,0.06)" strokeWidth="1" strokeDasharray="4 4" />
          <text x={pX - 6} y={g.y + 3.5} fill="rgba(26,31,54,0.38)" fontSize="8" textAnchor="end">{g.label}</text>
        </g>
      ))}
      <line x1={pX} y1={pY + innerH} x2={W - pX} y2={pY + innerH} stroke="rgba(0,0,0,0.08)" strokeWidth="1" />

      {/* Bars */}
      {data.map((d, i) => {
        const sx = getSalesX(i); const ex = getExpX(i);
        const sh = barH(d.sales);  const eh = barH(d.expenses);
        const sy = pY + innerH - sh; const ey = pY + innerH - eh;
        const isCur = i === lastIdx;
        return (
          <g key={d.label}>
            {/* Sales bar */}
            {sh > 0 && <rect x={sx} y={sy} width={bW} height={sh} rx="4" fill={`url(#s-${i})`} />}
            {/* Expense bar */}
            {eh > 0 && <rect x={ex} y={ey} width={bW} height={eh} rx="4" fill="rgba(244,63,94,0.50)" />}
            {/* Sales value (current month only to avoid clutter) */}
            {isCur && d.sales > 0 && (
              <text x={sx + bW / 2} y={sy - 5} fill="#f97316" fontSize="7.5" textAnchor="middle" fontWeight="700">
                {fmtShort(d.sales)}
              </text>
            )}
            {/* Expenses value */}
            {isCur && d.expenses > 0 && (
              <text x={ex + bW / 2} y={ey - 5} fill="#f43f5e" fontSize="7.5" textAnchor="middle" fontWeight="700">
                {fmtShort(d.expenses)}
              </text>
            )}
            {/* Month label */}
            <text x={sx + bW + gap / 2} y={H + 16}
              fill={isCur ? "rgba(26,31,54,0.85)" : "rgba(26,31,54,0.38)"}
              fontSize="9" textAnchor="middle" fontWeight={isCur ? "700" : "400"}>
              {d.label}
            </text>
            {isCur && <circle cx={sx + bW + gap / 2} cy={H + 21} r="2" fill="#f97316" />}
          </g>
        );
      })}
    </svg>
  );
}

// ── SVG Donut Chart ───────────────────────────────────────────────────────
function DonutChart({ entries, total }: { entries: PayEntry[]; total: number }) {
  const S = 176; const cx = S / 2; const cy = S / 2;
  const R = 72; const r = 50;

  function polar(angle: number, radius: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function arcPath(start: number, end: number) {
    const s = polar(start, R); const e = polar(end, R);
    const si = polar(end, r); const ei = polar(start, r);
    const large = end - start > 180 ? 1 : 0;
    return `M${s.x},${s.y} A${R},${R},0,${large},1,${e.x},${e.y} L${si.x},${si.y} A${r},${r},0,${large},0,${ei.x},${ei.y}Z`;
  }

  const activeEntries = entries.filter(e => e.pct > 0.5);
  let angle = 0;
  const segs = activeEntries.map(e => {
    const sweep = (e.pct / 100) * 360;
    const seg = { ...e, start: angle, end: angle + sweep };
    angle += sweep;
    return seg;
  });

  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="shrink-0">
      {segs.length === 0
        ? <circle cx={cx} cy={cy} r={R} fill="rgba(0,0,0,0.05)" />
        : segs.map((seg, i) => (
          <path key={i} d={arcPath(seg.start, seg.end)} fill={seg.color} opacity="0.88" />
        ))
      }
      {/* Inner fill — uses CSS variable so it matches the active theme background */}
      <circle cx={cx} cy={cy} r={r - 1} style={{ fill: 'var(--theme-donut-inner)' }} />
      {/* Center: total ₹ */}
      <text x={cx} y={cy - 9} textAnchor="middle" fill="#1A1F36" fontSize="12" fontWeight="700">
        {fmtShort(total)}
      </text>
      <text x={cx} y={cy + 5} textAnchor="middle" fill="rgba(26,31,54,0.40)" fontSize="7.5" fontWeight="600" letterSpacing="1">
        COLLECTED
      </text>
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon, colorFrom, colorTo, glow, textColor, hero = false,
}: {
  label: string; value: string; sub: string; icon: string;
  colorFrom: string; colorTo: string; glow: string; textColor: string; hero?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden flex flex-col gap-3"
      style={hero
        ? { background: `linear-gradient(135deg, ${colorFrom} 0%, ${colorTo} 100%)`, boxShadow: `0 8px 32px ${glow}` }
        : { background: "#FFFFFF", border: `1px solid rgba(0,0,0,0.07)`, borderLeft: `4px solid ${colorFrom}`, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }
      }
    >
      {/* Icon badge */}
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
        style={hero
          ? { background: "rgba(255,255,255,0.22)", color: "#fff" }
          : { background: `${colorFrom}18`, color: textColor }
        }
      >
        {icon}
      </div>

      <div>
        <p className="text-xs font-semibold mb-0.5" style={hero ? { color: "rgba(255,255,255,0.75)" } : { color: "#5A6882" }}>{label}</p>
        <p className="text-2xl font-black tracking-tight leading-none" style={hero ? { color: "#fff" } : { color: "#1A1F36" }}>
          {value}
        </p>
        <p className="text-[11px] mt-1.5" style={hero ? { color: "rgba(255,255,255,0.65)" } : { color: "#8FA3BF" }}>{sub}</p>
      </div>

      {/* Decorative circle for hero */}
      {hero && (
        <>
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-15" style={{ background: "rgba(255,255,255,0.5)" }} />
          <div className="absolute -right-2 -bottom-8 h-28 w-28 rounded-full opacity-10" style={{ background: "rgba(255,255,255,0.5)" }} />
        </>
      )}
    </div>
  );
}

// ── Stat Pill ─────────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
      style={{ background: "#FFFFFF", border: `1px solid ${color}30`, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-xs truncate" style={{ color: "#5A6882" }}>{label}</span>
      </div>
      <span className="text-sm font-black shrink-0" style={{ color: "#1A1F36" }}>{value}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [metrics,       setMetrics]       = useState<MetricSet>({ sales: 0, gst: 0, expenses: 0, creditDue: 0, rewardPoints: 0 });
  const [topItems,      setTopItems]      = useState<TopItem[]>([]);
  const [summary,       setSummary]       = useState<ReportSummary>({ grossSales: 0, netSales: 0, taxCollected: 0, expensesTotal: 0, profitEstimate: 0 });
  const [paymentSplit,  setPaymentSplit]  = useState<Record<string, number>>({});
  const [recentInvoices,setRecentInvoices]= useState<Invoice[]>([]);
  const [allInvoices,   setAllInvoices]   = useState<Invoice[]>([]);
  const [lowStock,      setLowStock]      = useState<LowStockItem[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [chartData,     setChartData]     = useState<ChartPoint[]>([]);
  const [startDate,     setStartDate]     = useState(() => new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [endDate,       setEndDate]       = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async (start: string, end: string) => {
    setLoading(true);
    try {
      const q = `?startDate=${start}&endDate=${end}`;
      const [dashRes, sumRes, invRes, itemsRes, chartRes] = await Promise.allSettled([
        apiClient.get(`/reports/dashboard${q}`),
        apiClient.get(`/reports/summary${q}`),
        apiClient.get(`/reports/invoices${q}`),
        apiClient.get("/items"),
        apiClient.get(`/reports/chart${q}`),
      ]);
      if (dashRes.status === "fulfilled") {
        if (dashRes.value.data?.metrics)  setMetrics(dashRes.value.data.metrics);
        if (dashRes.value.data?.topItems) setTopItems(dashRes.value.data.topItems);
      }
      if (sumRes.status === "fulfilled") {
        if (sumRes.value.data?.summary)      setSummary(sumRes.value.data.summary);
        if (sumRes.value.data?.paymentSplit) setPaymentSplit(sumRes.value.data.paymentSplit);
      }
      if (invRes.status === "fulfilled") {
        const list: Invoice[] = invRes.value.data?.invoices ?? [];
        setAllInvoices(list);
        setRecentInvoices(list.slice(0, 6));
      }
      if (itemsRes.status === "fulfilled") {
        setLowStock(
          (itemsRes.value.data?.items ?? [])
            .filter((i: LowStockItem) => Number(i.stockQty) <= 10)
            .sort((a: LowStockItem, b: LowStockItem) => a.stockQty - b.stockQty)
            .slice(0, 6),
        );
      }
      if (chartRes.status === "fulfilled") {
        setChartData(chartRes.value.data?.points ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(startDate, endDate); }, [fetchData]);

  // Derived values
  const grossSales      = summary.grossSales   || metrics.sales    || 0;
  const expenseTotal    = summary.expensesTotal || metrics.expenses || 0;
  const gstCollected    = summary.taxCollected  || metrics.gst      || 0;
  const netRevenue      = summary.profitEstimate || Math.max(grossSales - expenseTotal - gstCollected, 0);
  const creditDue       = metrics.creditDue  || 0;
  const rewardPoints    = metrics.rewardPoints || 0;
  const itemsSold       = topItems.reduce((s, i) => s + Number(i.qty || 0), 0);
  const totalInvoices   = summary.invoiceCount ?? allInvoices.length;

  // Payment entries — semantic colors, only show modes with data
  const payEntries: PayEntry[] = useMemo(() => {
    const entries = Object.entries(paymentSplit || {}).filter(([, v]) => Number(v) > 0);
    const total   = entries.reduce((s, [, v]) => s + Number(v), 0);
    return entries.map(([key, value]) => ({
      key, value: Number(value),
      pct: total > 0 ? (Number(value) / total) * 100 : 0,
      color: MODE_COLOR[key] ?? "#64748b",
    })).sort((a, b) => b.pct - a.pct);
  }, [paymentSplit]);

  const payTotal = payEntries.reduce((s, e) => s + e.value, 0);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Topbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="h-10 w-10 rounded-full border-2 border-t-transparent animate-spin mx-auto"
              style={{ borderColor: 'var(--theme-spinner-border) transparent transparent transparent' }} />
            <p className="text-sm" style={{ color: "#8FA3BF" }}>Loading dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar />

      <main className="flex-1 overflow-y-auto px-5 py-5 xl:px-8 xl:py-6">
        <div className="max-w-[1440px] mx-auto space-y-5">

          {/* ── Page heading ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black tracking-tight" style={{ color: "#1A1F36" }}>Store Overview</h1>
              <p className="text-xs mt-0.5" style={{ color: "#8FA3BF" }}>
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.09)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <label className="text-xs shrink-0" style={{ color: "#8FA3BF" }}>From</label>
                <input type="date" value={startDate} max={endDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-transparent text-xs outline-none cursor-pointer" style={{ color: "#1A1F36" }} />
                <span className="text-xs" style={{ color: "#B8C6D6" }}>–</span>
                <label className="text-xs shrink-0" style={{ color: "#8FA3BF" }}>To</label>
                <input type="date" value={endDate} min={startDate} max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-transparent text-xs outline-none cursor-pointer" style={{ color: "#1A1F36" }} />
                <button onClick={() => fetchData(startDate, endDate)}
                  className="ml-1 px-2.5 py-1 rounded-lg text-xs font-bold text-white transition-all active:scale-95"
                  style={{ background: "linear-gradient(135deg,#4361EE,#3451D1)" }}>
                  Apply
                </button>
              </div>
              <a href="/pos"
                className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #4361EE, #3451D1)", boxShadow: "0 4px 16px rgba(67,97,238,0.30)" }}>
                + New Sale
              </a>
            </div>
          </div>

          {/* ── KPI cards — 5 columns, each colour-coded ── */}
          <section className="grid grid-cols-2 xl:grid-cols-5 gap-4">
            <KpiCard
              label="Gross Sales" value={fmtFull(grossSales)} sub={`${totalInvoices} invoices total`}
              icon="₹" colorFrom={C.sales.from} colorTo={C.sales.to} glow={C.sales.glow} textColor={C.sales.text} hero
            />
            <KpiCard
              label="Total Expenses" value={fmtFull(expenseTotal)} sub="Operating costs"
              icon="↓" colorFrom={C.expenses.from} colorTo={C.expenses.to} glow={C.expenses.glow} textColor={C.expenses.text}
            />
            <KpiCard
              label="Net Revenue" value={fmtFull(netRevenue)} sub="After expenses & GST"
              icon="↑" colorFrom={C.profit.from} colorTo={C.profit.to} glow={C.profit.glow} textColor={C.profit.text}
            />
            <KpiCard
              label="GST Collected" value={fmtFull(gstCollected)} sub="CGST + SGST + IGST"
              icon="G" colorFrom={C.gst.from} colorTo={C.gst.to} glow={C.gst.glow} textColor={C.gst.text}
            />
            <KpiCard
              label="Credit Due" value={fmtFull(creditDue)} sub={creditDue > 0 ? "Pending recovery" : "No outstanding"}
              icon="!" colorFrom={C.credit.from} colorTo={C.credit.to} glow={C.credit.glow} textColor={C.credit.text}
            />
          </section>

          {/* ── Stat pills row ── */}
          <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatPill label="Total Invoices"  value={totalInvoices.toString()} color="#8b5cf6" />
            <StatPill label="Items Sold"      value={itemsSold.toString()}      color="#f97316" />
            <StatPill label="Reward Points"   value={rewardPoints.toFixed(0)}  color="#0ea5e9" />
            <StatPill label="Low Stock Items" value={lowStock.length.toString()} color={lowStock.length > 0 ? "#f43f5e" : "#10b981"} />
          </section>

          {/* ── Charts row ── */}
          <section className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">

            {/* Monthly sales chart */}
            <div
              className="rounded-2xl p-5"
              style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold" style={{ color: "#1A1F36" }}>Monthly Revenue</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: "#8FA3BF" }}>Last 6 months — current month highlighted</p>
                </div>
                <div className="flex items-center gap-3 text-[10px]" style={{ color: "#8FA3BF" }}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm inline-block" style={{ background: "linear-gradient(#f97316,#ef4444)" }} />
                    Sales
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm inline-block" style={{ background: "rgba(244,63,94,0.50)" }} />
                    Expenses
                  </span>
                </div>
              </div>

              <BarChart data={chartData} />

              {/* Summary strip */}
              <div
                className="mt-3 pt-3 grid grid-cols-3 gap-2"
                style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
              >
                {[
                  { label: "Gross Sales",  value: fmtFull(grossSales),   color: C.sales.text },
                  { label: "Total Expense", value: fmtFull(expenseTotal), color: C.credit.text },
                  { label: "Net Revenue",  value: fmtFull(netRevenue),   color: C.profit.text },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-[10px] mb-0.5" style={{ color: "#8FA3BF" }}>{s.label}</p>
                    <p className="text-xs font-black" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment breakdown donut */}
            <div
              className="rounded-2xl p-5 flex flex-col"
              style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
            >
              <div className="mb-4">
                <h3 className="text-sm font-bold" style={{ color: "#1A1F36" }}>Payment Mix</h3>
                <p className="text-[11px] mt-0.5" style={{ color: "#8FA3BF" }}>By collection value</p>
              </div>

              {payEntries.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs" style={{ color: "#B8C6D6" }}>No payment data</div>
              ) : (
                <>
                  <div className="flex justify-center mb-4">
                    <DonutChart entries={payEntries} total={payTotal} />
                  </div>

                  <div className="space-y-2 flex-1">
                    {payEntries.map(e => (
                      <div key={e.key} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: e.color }} />
                            <span className="font-medium" style={{ color: "#5A6882" }}>{e.key}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px]" style={{ color: "#8FA3BF" }}>{fmtShort(e.value)}</span>
                            <span className="font-bold w-8 text-right" style={{ color: "#1A1F36" }}>{e.pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        {/* Mini progress bar */}
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                          <div className="h-full rounded-full" style={{ width: `${e.pct}%`, background: e.color, opacity: 0.80 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ── Bottom row ── */}
          <section className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">

            {/* Recent invoices */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
              >
                <div>
                  <h3 className="text-sm font-bold" style={{ color: "#1A1F36" }}>Recent Invoices</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: "#8FA3BF" }}>Latest billing records</p>
                </div>
                <a href="/invoices" className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ color: "#4361EE", background: "rgba(67,97,238,0.08)", border: "1px solid rgba(67,97,238,0.18)" }}>
                  View all →
                </a>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#F7F9FC" }}>
                      {["Invoice", "Customer", "Date & Time", "Amount", "Mode"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest" style={{ color: "#8FA3BF" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-xs" style={{ color: "#B8C6D6" }}>
                          No invoices yet. Start billing from POS.
                        </td>
                      </tr>
                    ) : recentInvoices.map((inv, i) => {
                      const modeColor = MODE_COLOR[inv.paymentMode] ?? "#64748b";
                      return (
                        <tr
                          key={inv.id}
                          className="group cursor-default"
                          style={i < recentInvoices.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : undefined}
                          onMouseEnter={e => (e.currentTarget.style.background = "#F7F9FC")}
                          onMouseLeave={e => (e.currentTarget.style.background = "")}
                        >
                          {/* Invoice no */}
                          <td className="px-4 py-2.5">
                            <span className="text-xs font-bold" style={{ color: "#4361EE" }}>#{inv.invoiceSequence}</span>
                          </td>
                          {/* Customer */}
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                                style={{ background: "rgba(67,97,238,0.10)", color: "#4361EE" }}
                              >
                                {(inv.customer?.name || "W")[0].toUpperCase()}
                              </div>
                              <span className="text-xs truncate max-w-[110px]" style={{ color: "#5A6882" }}>
                                {inv.customer?.name || inv.customer?.mobileNumber || "Walk-in"}
                              </span>
                            </div>
                          </td>
                          {/* Date */}
                          <td className="px-4 py-2.5">
                            <p className="text-xs" style={{ color: "#5A6882" }}>{fmtDate(inv.createdAt)}</p>
                            <p className="text-[10px]" style={{ color: "#8FA3BF" }}>{fmtTime(inv.createdAt)}</p>
                          </td>
                          {/* Amount */}
                          <td className="px-4 py-2.5">
                            <span className="text-xs font-black" style={{ color: "#1A1F36" }}>{fmtFull(inv.grandTotal)}</span>
                          </td>
                          {/* Mode badge */}
                          <td className="px-4 py-2.5">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: `${modeColor}18`, color: modeColor, border: `1px solid ${modeColor}30` }}
                            >
                              {inv.paymentMode}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right column: Stock + Top Items */}
            <div className="space-y-4">

              {/* Stock Alert */}
              <div
                className="rounded-2xl p-4"
                style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold" style={{ color: "#1A1F36" }}>Stock Alert</h3>
                  {lowStock.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(244,63,94,0.15)", color: "#fb7185", border: "1px solid rgba(244,63,94,0.25)" }}>
                      {lowStock.length} low
                    </span>
                  )}
                </div>

                {lowStock.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="h-8 w-8 rounded-full mx-auto mb-2 flex items-center justify-center text-emerald-400 font-black"
                      style={{ background: "rgba(16,185,129,0.12)" }}>✓</div>
                    <p className="text-xs font-semibold text-emerald-400">All stocked up</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#8FA3BF" }}>No items below threshold</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {lowStock.map(item => {
                      const isCritical = item.stockQty <= 5;
                      const color = isCritical ? "#f43f5e" : "#f59e0b";
                      return (
                        <div key={item.id} className="flex items-center gap-3 py-1">
                          <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold truncate" style={{ color: "#1A1F36" }}>{item.name}</p>
                          </div>
                          <span className="text-xs font-black shrink-0" style={{ color }}>{item.stockQty}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Selling Items */}
              {topItems.length > 0 && (
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
                >
                  <h3 className="text-sm font-bold mb-3" style={{ color: "#1A1F36" }}>Top Sellers</h3>
                  <div className="space-y-2.5">
                    {topItems.slice(0, 4).map((item, i) => {
                      const maxQty = Math.max(...topItems.slice(0, 4).map(t => t.qty), 1);
                      const pct = (item.qty / maxQty) * 100;
                      const rankColors = ["#f97316", "#8b5cf6", "#0ea5e9", "#10b981"];
                      const color = rankColors[i] ?? "#64748b";
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black w-4 text-center" style={{ color }}>#{i + 1}</span>
                              <span className="text-[11px] truncate max-w-[120px]" style={{ color: "#5A6882" }}>{item.name}</span>
                            </div>
                            <span className="text-[10px] font-bold shrink-0" style={{ color: "#8FA3BF" }}>{item.qty} sold</span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden ml-6" style={{ background: "rgba(0,0,0,0.06)" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color, opacity: 0.75 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
