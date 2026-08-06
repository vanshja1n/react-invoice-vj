import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/* ─────────────────────────────────────────────────────────────
   Pure utility helpers — no React, no side-effects.
   All calculations happen in a single useMemo in the component.
───────────────────────────────────────────────────────────────*/

/** Return "YYYY-MM-DD" string in LOCAL time for a Date object. */
function toLocalDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Add `days` days to a Date, returning a new Date. */
function addDays(d, days) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** Build array of "YYYY-MM-DD" keys for every calendar day in [start, end]. */
function fillMissingDates(startDate, endDate) {
  const keys = [];
  let cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    keys.push(toLocalDateKey(cur));
    cur = addDays(cur, 1);
  }
  return keys;
}

/**
 * Return the {start, end} Date boundaries for a named period.
 * `today` should be passed in as a stable Date(today) reference.
 */
function getPeriodBounds(rangeKey, today) {
  const t = new Date(today);
  t.setHours(23, 59, 59, 999);
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  switch (rangeKey) {
    case '7d': {
      return { start: addDays(start, -6), end: t };
    }
    case '30d': {
      return { start: addDays(start, -29), end: t };
    }
    case 'thisMonth': {
      return {
        start: new Date(start.getFullYear(), start.getMonth(), 1),
        end: t,
      };
    }
    case 'prevMonth': {
      const firstOfThisMonth = new Date(start.getFullYear(), start.getMonth(), 1);
      const lastOfPrevMonth = addDays(firstOfThisMonth, -1);
      lastOfPrevMonth.setHours(23, 59, 59, 999);
      const firstOfPrevMonth = new Date(
        lastOfPrevMonth.getFullYear(),
        lastOfPrevMonth.getMonth(),
        1,
      );
      return { start: firstOfPrevMonth, end: lastOfPrevMonth };
    }
    case 'thisYear': {
      return {
        start: new Date(start.getFullYear(), 0, 1),
        end: t,
      };
    }
    default:
      return { start: addDays(start, -6), end: t };
  }
}

/**
 * Given the current period bounds, return the immediately preceding
 * period of the same length.
 */
function getComparisonPeriod(currentStart, currentEnd) {
  const lengthMs = currentEnd.getTime() - currentStart.getTime();
  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - lengthMs);
  return { start: prevStart, end: prevEnd };
}

/**
 * Group an array of invoices into { [dateKey]: { collected, invoiced, count } }
 * for invoices whose date falls within [startDate, endDate].
 */
function groupInvoicesByDate(invoices, startDate, endDate) {
  const map = {};
  for (const inv of invoices) {
    const raw = inv.issueDate || inv.invoiceDate || inv.createdAt;
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    if (d < startDate || d > endDate) continue;
    const key = toLocalDateKey(d);
    if (!map[key]) map[key] = { collected: 0, invoiced: 0, count: 0 };
    const amount = parseFloat(inv.total || inv.amount || 0);
    map[key].invoiced += amount;
    map[key].count += 1;
    if (inv.status === 'paid') map[key].collected += amount;
  }
  return map;
}

/**
 * Build chart-ready data points with every date in the range filled.
 */
function getRevenueByDay(invoices, startDate, endDate) {
  const grouped = groupInvoicesByDate(invoices, startDate, endDate);
  const keys = fillMissingDates(startDate, endDate);
  return keys.map((key) => {
    const bucket = grouped[key] || { collected: 0, invoiced: 0, count: 0 };
    const label = new Date(key + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric',
      month: keys.length > 60 ? 'short' : undefined,
    });
    return {
      date: key,
      label,
      collected: parseFloat(bucket.collected.toFixed(2)),
      invoiced: parseFloat(bucket.invoiced.toFixed(2)),
      count: bucket.count,
    };
  });
}

/**
 * Summarise totals for a given period.
 */
function getRevenueSummary(invoices, startDate, endDate) {
  let collected = 0;
  let invoiced = 0;
  let count = 0;
  for (const inv of invoices) {
    const raw = inv.issueDate || inv.invoiceDate || inv.createdAt;
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    if (d < startDate || d > endDate) continue;
    const amount = parseFloat(inv.total || inv.amount || 0);
    invoiced += amount;
    count += 1;
    if (inv.status === 'paid') collected += amount;
  }
  return { collected, invoiced, count };
}

/**
 * Calculate growth percentage. Returns null when prev === 0 ("New").
 */
function getGrowth(current, previous) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/* ─────────────────────────────────────────────────────────────
   Currency formatter helpers
───────────────────────────────────────────────────────────────*/
function fmtShort(v, currency) {
  if (v === 0) return `${currency}0`;
  if (v >= 10_00_000) return `${currency}${(v / 10_00_000).toFixed(1)}L`;
  if (v >= 1_000) return `${currency}${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}k`;
  return `${currency}${v.toFixed(0)}`;
}

function fmtFull(v, currency) {
  return `${currency}${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/* ─────────────────────────────────────────────────────────────
   Range options
───────────────────────────────────────────────────────────────*/
const RANGE_OPTIONS = [
  { value: '7d',        label: 'Last 7 Days' },
  { value: '30d',       label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'prevMonth', label: 'Previous Month' },
  { value: 'thisYear',  label: 'This Year' },
];

/* ─────────────────────────────────────────────────────────────
   Custom Tooltip — premium dark-card SaaS style
───────────────────────────────────────────────────────────────*/
function RevenueTooltip({ active, payload, label, currency }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const avg = d.count > 0 ? d.collected / d.count : 0;

  const dateObj = d.date ? new Date(d.date + 'T00:00:00') : null;
  const dateLabel = dateObj
    ? dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : label;

  return (
    <div
      style={{
        minWidth: 210,
        padding: '0',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        backgroundColor: 'hsl(240 10% 8%)',
        color: 'hsl(0 0% 98%)',
        boxShadow: '0 16px 48px -8px rgba(0,0,0,0.55), 0 4px 16px -4px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          padding: '9px 14px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.04)',
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'hsl(0 0% 92%)',
            margin: 0,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
          }}
        >
          {dateLabel}
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 14px 12px' }}>
        {/* Daily Collected */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
            <span
              style={{
                height: 8, width: 8, borderRadius: '50%',
                background: 'hsl(217 91% 62%)',
                boxShadow: '0 0 6px hsl(217 91% 62% / 0.7)',
                flexShrink: 0, display: 'inline-block',
              }}
            />
            Daily Collected
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'hsl(217 91% 72%)' }}>
            {fmtFull(d.collected, currency)}
          </span>
        </div>

        {/* Daily Invoiced */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: d.count > 0 ? 10 : 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
            <span
              style={{
                height: 8, width: 8, borderRadius: '50%',
                background: 'hsl(142 71% 48%)',
                boxShadow: '0 0 6px hsl(142 71% 48% / 0.7)',
                flexShrink: 0, display: 'inline-block',
              }}
            />
            Daily Invoiced
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'hsl(142 71% 62%)' }}>
            {fmtFull(d.invoiced, currency)}
          </span>
        </div>

        {d.count > 0 && (
          <>
            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', margin: '2px 0 10px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: avg > 0 ? 5 : 0 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Invoices</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{d.count}</span>
            </div>
            {avg > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Avg. Invoice</span>
                <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.75)' }}>{fmtFull(avg, currency)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   KPI Card sub-component — premium chip design
───────────────────────────────────────────────────────────────*/
function KpiCard({ label, value, growth, growthLabel, accentColor, accentBg, borderColor }) {
  const isNew = growth === null;
  const isPositive = !isNew && growth > 0;
  const isFlat = !isNew && growth === 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '16px 18px',
        borderRadius: 14,
        background: accentBg,
        border: `1px solid ${borderColor}`,
        minWidth: 0,
        flex: 1,
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: 'hsl(var(--muted-foreground))',
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          color: accentColor,
          margin: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
        {isNew ? (
          <>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'hsl(var(--muted-foreground))',
                backgroundColor: 'hsl(var(--muted))',
                padding: '2px 7px',
                borderRadius: 99,
              }}
            >
              New
            </span>
            <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', lineHeight: 1.2 }}>
              Initial period
            </span>
          </>
        ) : isFlat ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
            <Minus style={{ width: 10, height: 10 }} />
            No change
          </span>
        ) : isPositive ? (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              fontWeight: 700,
              color: 'hsl(142 71% 38%)',
              backgroundColor: 'hsl(142 71% 45% / 0.12)',
              padding: '2px 7px',
              borderRadius: 99,
            }}
          >
            <TrendingUp style={{ width: 10, height: 10 }} />
            +{growth.toFixed(1)}%
          </span>
        ) : (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              fontWeight: 700,
              color: 'hsl(0 72% 51%)',
              backgroundColor: 'hsl(0 72% 51% / 0.1)',
              padding: '2px 7px',
              borderRadius: 99,
            }}
          >
            <TrendingDown style={{ width: 10, height: 10 }} />
            {growth.toFixed(1)}%
          </span>
        )}
        {!isNew && (
          <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', lineHeight: 1.2 }}>
            {growthLabel}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────────*/
export function RevenueOverviewCard({ invoices }) {
  const currency = (invoices && invoices.length > 0 ? invoices[0].currency : null) || '₹';

  const [rangeKey, setRangeKey] = useState('7d');

  // Stable "today" — same value for the entire render tree
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const derived = useMemo(() => {
    const { start, end } = getPeriodBounds(rangeKey, today);
    const prev = getComparisonPeriod(start, end);

    const chartData = getRevenueByDay(invoices || [], start, end);
    const current = getRevenueSummary(invoices || [], start, end);
    const previous = getRevenueSummary(invoices || [], prev.start, prev.end);

    const collectedGrowth = getGrowth(current.collected, previous.collected);
    const invoicedGrowth = getGrowth(current.invoiced, previous.invoiced);
    const growthPct = getGrowth(current.collected, previous.collected);

    // Header date range label
    const rangeLabel = (() => {
      const opts = { day: 'numeric', month: 'short' };
      const s = start.toLocaleDateString('en-IN', opts);
      const e = end.toLocaleDateString('en-IN', opts);
      if (rangeKey === 'thisYear') {
        return `${start.getFullYear()}`;
      }
      return `${s} – ${e}`;
    })();

    const growthLabel = (() => {
      const opts = RANGE_OPTIONS.find((o) => o.value === rangeKey);
      return `vs prev. ${opts?.label?.toLowerCase() || 'period'}`;
    })();

    const growthDirection =
      growthPct === null ? 'new'
      : growthPct > 0 ? 'up'
      : growthPct < 0 ? 'down'
      : 'flat';

    return {
      chartData,
      current,
      previous,
      collectedGrowth,
      invoicedGrowth,
      growthPct,
      growthDirection,
      rangeLabel,
      growthLabel,
      hasData: chartData.some((d) => d.invoiced > 0 || d.collected > 0),
    };
  }, [invoices, rangeKey, today]);

  const {
    chartData,
    current,
    collectedGrowth,
    invoicedGrowth,
    growthPct,
    growthDirection,
    rangeLabel,
    growthLabel,
    hasData,
  } = derived;

  // Y-axis tick formatter
  const yTickFmt = (v) => fmtShort(v, currency);

  // Dynamic Y-axis domain: automatically scale to data range [0, dataMax * 1.05]
  const yAxisDomain = useMemo(() => {
    if (!hasData) return [0, 'auto'];
    const maxVal = Math.max(...chartData.map((d) => Math.max(d.collected || 0, d.invoiced || 0)));
    if (maxVal === 0) return [0, 100];
    return [0, Math.ceil(maxVal * 1.05)];
  }, [chartData, hasData]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRadius: 20,
        border: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--card))',
        color: 'hsl(var(--card-foreground))',
        boxShadow: '0 4px 24px -4px rgba(0,0,0,0.08), 0 1px 4px -1px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: '20px 22px 0',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'hsl(var(--foreground))',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Revenue Overview
          </h2>
          <p
            style={{
              fontSize: 12,
              color: 'hsl(var(--muted-foreground))',
              marginTop: 3,
              fontWeight: 500,
              margin: '3px 0 0',
            }}
          >
            {rangeLabel}
          </p>
        </div>

        {/* Filter dropdown with active indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Active Filter
          </span>
          <Select value={rangeKey} onValueChange={setRangeKey}>
            <SelectTrigger
              style={{
                height: 32,
                fontSize: 12,
                width: 140,
                flexShrink: 0,
                borderRadius: 8,
                border: '1px solid hsl(217 91% 60% / 0.35)',
                backgroundColor: 'hsl(var(--muted) / 0.6)',
                paddingLeft: 10,
                paddingRight: 8,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <SelectValue />
            </SelectTrigger>
          <SelectContent align="end" style={{ fontSize: 12 }}>
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} style={{ fontSize: 12 }}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      </div>

      {/* ── Period Summary Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 22px 14px',
          backgroundColor: 'hsl(var(--muted) / 0.2)',
          borderBottom: '1px solid hsl(var(--border) / 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>Period Collected: </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(217 91% 65%)' }}>{fmtFull(current.collected, currency)}</span>
          </div>
          <div style={{ height: 12, width: 1, backgroundColor: 'hsl(var(--border))' }} />
          <div>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>Period Invoiced: </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(142 71% 52%)' }}>{fmtFull(current.invoiced, currency)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Growth:</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: growthDirection === 'up' ? 'hsl(142 71% 52%)' : growthDirection === 'down' ? 'hsl(0 72% 51%)' : 'hsl(var(--muted-foreground))',
            }}
          >
            {growthPct === null ? 'New' : `${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}%`}
          </span>
        </div>
      </div>

      {/* ── Chart ── */}
      <div style={{ flex: 1, padding: '12px 8px 16px 4px', minHeight: 240 }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 12, left: -4, bottom: 12 }}
            >
              <defs>
                {/* Bright blue gradient for collected — deep fill */}
                <linearGradient id="roCollectedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(217 91% 62%)" stopOpacity={0.45} />
                  <stop offset="40%" stopColor="hsl(217 91% 62%)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="hsl(217 91% 62%)" stopOpacity={0} />
                </linearGradient>
                {/* Vibrant green gradient for invoiced — deep fill */}
                <linearGradient id="roInvoicedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(142 71% 48%)" stopOpacity={0.35} />
                  <stop offset="45%" stopColor="hsl(142 71% 48%)" stopOpacity={0.10} />
                  <stop offset="100%" stopColor="hsl(142 71% 48%)" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
                strokeOpacity={0.45}
              />

              <XAxis
                dataKey="label"
                tick={{
                  fontSize: 10,
                  fill: 'hsl(240 5% 82%)',
                  fontWeight: 600,
                }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
                dy={4}
              />

              <YAxis
                tick={{
                  fontSize: 10,
                  fill: 'hsl(240 5% 82%)',
                  fontWeight: 600,
                }}
                axisLine={false}
                tickLine={false}
                tickFormatter={yTickFmt}
                width={46}
                domain={yAxisDomain}
                allowDecimals={false}
              />

              <ReTooltip
                content={<RevenueTooltip currency={currency} />}
                animationBegin={0}
                animationDuration={120}
                cursor={{
                  stroke: 'hsl(var(--muted-foreground))',
                  strokeWidth: 1,
                  strokeDasharray: '3 4',
                  strokeOpacity: 0.4,
                }}
              />

              {/* Invoiced area — vibrant green, smooth Bezier */}
              <Area
                type="monotoneX"
                dataKey="invoiced"
                stroke="hsl(142 71% 52%)"
                strokeWidth={2}
                strokeOpacity={0.9}
                fill="url(#roInvoicedGrad)"
                dot={false}
                activeDot={{
                  r: 5,
                  strokeWidth: 2.5,
                  stroke: 'hsl(240 10% 8%)',
                  fill: 'hsl(142 71% 52%)',
                  filter: 'drop-shadow(0 0 4px hsl(142 71% 52% / 0.8))',
                }}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-out"
              />

              {/* Collected area — bright blue, primary line */}
              <Area
                type="monotoneX"
                dataKey="collected"
                stroke="hsl(217 91% 65%)"
                strokeWidth={3}
                strokeOpacity={1}
                fill="url(#roCollectedGrad)"
                dot={false}
                activeDot={{
                  r: 6,
                  strokeWidth: 2.5,
                  stroke: 'hsl(240 10% 8%)',
                  fill: 'hsl(217 91% 65%)',
                  filter: 'drop-shadow(0 0 5px hsl(217 91% 65% / 0.85))',
                }}
                isAnimationActive={true}
                animationDuration={1100}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 230,
              gap: 8,
            }}
          >
            {/* Empty state illustration */}
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              style={{ opacity: 0.3 }}
            >
              <rect x="4" y="28" width="6" height="8" rx="1.5" fill="hsl(var(--muted-foreground))" />
              <rect x="13" y="20" width="6" height="16" rx="1.5" fill="hsl(var(--muted-foreground))" />
              <rect x="22" y="14" width="6" height="22" rx="1.5" fill="hsl(var(--muted-foreground))" />
              <rect x="31" y="8" width="6" height="28" rx="1.5" fill="hsl(var(--muted-foreground))" />
            </svg>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'hsl(var(--muted-foreground))',
                margin: 0,
              }}
            >
              No revenue in this period
            </p>
            <p
              style={{
                fontSize: 11,
                color: 'hsl(var(--muted-foreground))',
                opacity: 0.65,
                margin: 0,
              }}
            >
              Try a different range or create an invoice
            </p>
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      {hasData && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            paddingBottom: 16,
            paddingTop: 2,
          }}
        >
          {[
            { label: 'Collected', color: 'hsl(217 91% 65%)', glow: 'hsl(217 91% 65% / 0.6)' },
            { label: 'Invoiced',  color: 'hsl(142 71% 52%)', glow: 'hsl(142 71% 52% / 0.6)' },
          ].map(({ label, color, glow }) => (
            <span
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: 'hsl(var(--muted-foreground))',
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  height: 8,
                  width: 24,
                  borderRadius: 4,
                  backgroundColor: color,
                  boxShadow: `0 0 6px ${glow}`,
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
