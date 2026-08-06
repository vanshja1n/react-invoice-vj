import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  ArrowUpRight,
  Package,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { DashboardSkeleton } from '@/components/shared/LoadingSkeleton';
import { StockBadge } from '@/components/shared/StockBadge';
import { useInvoices } from '@/hooks/useInvoices';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers } from '@/hooks/useCustomers';
import { formatCurrency, toTitleCase } from '@/types/invoice';
import { RevenueOverviewCard } from '@/components/dashboard/RevenueOverviewCard';
import {
  PieChart,
  Pie,
  Cell,
  Label as PieLabel,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from 'recharts';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const PIE_COLORS = {
  paid: 'hsl(142, 71%, 45%)',
  pending: 'hsl(38, 92%, 50%)',
  sent: 'hsl(217, 91%, 60%)',
  overdue: 'hsl(0, 84%, 60%)',
  draft: 'hsl(220, 9%, 46%)',
  cancelled: 'hsl(210, 16%, 53%)',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { invoices, loading: invLoading, stats: invStats } = useInvoices();
  const { stats: prodStats, getLowStock } = useProducts();
  const { customers, stats: custStats } = useCustomers();

  const [lowStockProducts, setLowStockProducts] = useState([]);

  useEffect(() => {
    getLowStock().then(setLowStockProducts);
  }, [invoices, getLowStock]);

  if (invLoading) return <DashboardSkeleton />;

  const statCards = [
    {
      label: 'Total Revenue',
      value: formatCurrency(invStats?.totalRevenue || 0, invoices[0]?.currency || '₹'),
      subtext: `${formatCurrency(invStats?.paidRevenue || 0, invoices[0]?.currency || '₹')} collected`,
      icon: DollarSign,
      color: 'text-violet-400',
      bg: 'bg-violet-500/15 border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]',
      colSpan: 'sm:col-span-2 lg:col-span-1',
    },
    {
      label: 'Pending Amount',
      value: formatCurrency(invStats?.pendingAmount || 0, invoices[0]?.currency || '₹'),
      subtext: 'From sent, pending & overdue',
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/15 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
    },
    {
      label: 'Total Invoices',
      value: invStats?.total || 0,
      subtext: `${invStats?.paid || 0} paid, ${invStats?.overdue || 0} overdue`,
      icon: FileText,
      color: 'text-blue-400',
      bg: 'bg-blue-500/15 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]',
    },
    {
      label: 'Total Customers',
      value: custStats?.total || 0,
      subtext: 'Across all invoices',
      icon: Users,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    },
    {
      label: 'Total Products',
      value: prodStats?.total || 0,
      subtext: `${prodStats?.lowStock || 0} low stock items`,
      icon: Package,
      color: 'text-orange-400',
      bg: 'bg-orange-500/15 border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.15)]',
    },
  ];

  const pieData = [
    { name: 'Paid', value: invStats?.paid || 0, fill: PIE_COLORS.paid },
    { name: 'Pending', value: invStats?.pending || 0, fill: PIE_COLORS.pending },
    { name: 'Sent', value: invStats?.sent || 0, fill: PIE_COLORS.sent },
    { name: 'Overdue', value: invStats?.overdue || 0, fill: PIE_COLORS.overdue },
    { name: 'Draft', value: invStats?.draft || 0, fill: PIE_COLORS.draft },
    { name: 'Cancelled', value: invStats?.cancelled || 0, fill: PIE_COLORS.cancelled },
  ].filter(d => d.value > 0);

  const recentInvoices = invoices.slice(0, 5);
  const recentCustomers = customers.slice(0, 5);

  const currency = invoices.length > 0 ? invoices[0].currency || '₹' : '₹';

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your business activity"
      >
        <Button onClick={() => navigate('/invoices/new')} size="sm" className="gap-1.5 btn-primary-interactive">
          <Plus className="h-4 w-4" /> New Invoice
        </Button>
      </PageHeader>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {statCards.map((s) => (
            <motion.div key={s.label} variants={item} className={s.colSpan || ''}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="pt-5 pb-4 px-5 h-full flex flex-col justify-between">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">{s.label}</p>
                      <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                    </div>
                    <div className={`rounded-xl p-2.5 shrink-0 ${s.bg}`}>
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                  </div>
                  {/* Subtext: bumped to text-[12px] for WCAG legibility with breathing room */}
                  <p className="text-[12px] text-muted-foreground font-medium leading-snug mt-3.5">{s.subtext}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue Overview Card — premium SaaS analytics */}
          <motion.div variants={item} className="lg:col-span-2">
            <RevenueOverviewCard invoices={invoices} />
          </motion.div>

          {/* Status Pie */}
          <motion.div variants={item}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Invoice Status</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {pieData.length > 0 ? (() => {
                  const totalInvoices = pieData.reduce((s, d) => s + d.value, 0);
                  const paidCount = invStats?.paid || 0;
                  const paidPct = totalInvoices > 0 ? Math.round((paidCount / totalInvoices) * 100) : 0;
                  return (
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={190}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={62}
                            outerRadius={82}
                            paddingAngle={2}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                            <PieLabel
                              content={({ viewBox }) => {
                                const { cx, cy } = viewBox;
                                return (
                                  <g>
                                    <text
                                      x={cx}
                                      y={cy - 12}
                                      textAnchor="middle"
                                      dominantBaseline="central"
                                      style={{
                                        fontSize: 22,
                                        fontWeight: 800,
                                        fill: paidPct === 100 ? 'hsl(142 71% 52%)' : 'hsl(0 0% 96%)',
                                        letterSpacing: '-0.02em',
                                        fontFamily: 'inherit',
                                      }}
                                    >
                                      {paidPct}%
                                    </text>
                                    <text
                                      x={cx}
                                      y={cy + 16}
                                      textAnchor="middle"
                                      dominantBaseline="central"
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        fill: 'hsl(var(--muted-foreground))',
                                        letterSpacing: '0.02em',
                                        fontFamily: 'inherit',
                                      }}
                                    >
                                      {paidCount} Paid
                                    </text>
                                  </g>
                                );
                              }}
                            />
                          </Pie>
                          <ReTooltip
                            contentStyle={{
                              borderRadius: '10px',
                              border: '1px solid rgba(255,255,255,0.08)',
                              backgroundColor: 'hsl(240 10% 8%)',
                              color: 'hsl(0 0% 95%)',
                              fontSize: '12px',
                              boxShadow: '0 12px 32px -6px rgba(0,0,0,0.45)',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Always-visible legend: Paid · Pending · Overdue with interactive hover states */}
                      <div className="flex flex-wrap justify-center gap-x-2 gap-y-2 mt-1">
                        {[
                          { name: 'Paid',     fill: PIE_COLORS.paid,    count: invStats?.paid    || 0 },
                          { name: 'Pending',  fill: PIE_COLORS.pending, count: invStats?.pending || 0 },
                          { name: 'Overdue',  fill: PIE_COLORS.overdue, count: invStats?.overdue || 0 },
                          ...(invStats?.sent   > 0 ? [{ name: 'Sent',      fill: PIE_COLORS.sent,    count: invStats.sent }]   : []),
                          ...(invStats?.draft  > 0 ? [{ name: 'Draft',     fill: PIE_COLORS.draft,   count: invStats.draft }]  : []),
                        ].map((d) => (
                          <div
                            key={d.name}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-transparent hover:border-border hover:bg-muted/40 transition-all cursor-pointer select-none"
                            style={{ opacity: d.count === 0 ? 0.35 : 1 }}
                          >
                            <span
                              className="h-2 w-2 rounded-full shrink-0 shadow-[0_0_6px_currentColor]"
                              style={{ backgroundColor: d.fill, color: d.fill }}
                            />
                            <span className="font-semibold">{d.name}</span>
                            <span className="text-muted-foreground font-mono">({d.count})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="flex items-center justify-center h-[190px] text-sm text-muted-foreground">
                    No invoices yet
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Lower Row: 3 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Recent Invoices */}
          <motion.div variants={item} className="lg:col-span-1">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Recent Invoices</CardTitle>
                  {invoices.length > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2 gap-1 -mr-2 text-muted-foreground btn-ghost-interactive" onClick={() => navigate('/invoices')}>
                      View All <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                {recentInvoices.length > 0 ? (
                  <div className="space-y-3.5">
                    {recentInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                        className="widget-row flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20 cursor-pointer"
                      >
                        <div className="min-w-0 pr-3 flex-1 flex flex-col gap-1">
                          <p className="text-sm font-semibold truncate leading-tight">
                            {inv.clientName ? toTitleCase(inv.clientName) : 'No client'}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono leading-none">
                            {inv.invoiceNumber || 'Draft'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end shrink-0 gap-1">
                          <span className="text-sm font-bold leading-tight">
                            {formatCurrency(inv.total, inv.currency)}
                          </span>
                          <div className="scale-[0.85] origin-right">
                            <StatusBadge status={inv.status} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={FileText}
                    title="No invoices yet"
                    description="Create your first invoice"
                    actionLabel="Create Invoice"
                    onAction={() => navigate('/invoices/new')}
                    compact
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Low Stock Alerts */}
          <motion.div variants={item} className="lg:col-span-1">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Low Stock Alerts
                  </CardTitle>
                  {lowStockProducts.length > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2 gap-1 -mr-2 text-muted-foreground btn-ghost-interactive" onClick={() => navigate('/products')}>
                      View All <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                {lowStockProducts.length > 0 ? (
                  <div className="space-y-3.5">
                    {lowStockProducts.slice(0, 5).map((product) => (
                      <div
                        key={product.id}
                        onClick={() => navigate('/products')}
                        className="widget-row flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20 cursor-pointer"
                      >
                        <div className="min-w-0 pr-3 flex-1 flex flex-col gap-1">
                          <p className="text-sm font-semibold truncate leading-tight">{toTitleCase(product.name)}</p>
                          <p className="text-xs text-muted-foreground font-mono leading-none">{product.sku}</p>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <StockBadge product={product} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={CheckCircle2}
                    title="Stock looks good!"
                    description="No low stock alerts at the moment."
                    compact
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Customers */}
          <motion.div variants={item} className="lg:col-span-1">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-500" />
                    Recent Customers
                  </CardTitle>
                  {customers.length > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2 gap-1 -mr-2 text-muted-foreground btn-ghost-interactive" onClick={() => navigate('/customers')}>
                      View All <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                {recentCustomers.length > 0 ? (
                  <div className="space-y-3.5">
                    {recentCustomers.map((customer) => (
                      <div
                        key={customer.id}
                        onClick={() => navigate('/customers')}
                        className="widget-row flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20 cursor-pointer"
                      >
                        <div className="min-w-0 pr-3 flex-1 flex flex-col gap-1">
                          <p className="text-sm font-semibold truncate leading-tight">{toTitleCase(customer.name)}</p>
                          <p className="text-xs text-muted-foreground truncate leading-none">
                            {[customer.email, customer.phone].filter(Boolean)[0] || 'No contact'}
                          </p>
                        </div>
                        <div className="flex items-center justify-center h-7 w-7 text-muted-foreground shrink-0 rounded-md transition-colors group-hover:text-foreground">
                          <ArrowUpRight className="h-4 w-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Users}
                    title="No customers yet"
                    description="Add clients to get started"
                    actionLabel="Add Customer"
                    onAction={() => navigate('/customers')}
                    compact
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>

        </div>

        <motion.div variants={item} className="flex flex-col items-center justify-center pt-2 pb-4">
          <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground/80">
            Software Developed by{' '}
            <span className="font-semibold text-foreground drop-shadow-[0_0_10px_rgba(56,189,248,0.18)]">
              Vansh Jain
            </span>
          </p>
          <div className="footer-line-track mt-2 h-[1px] w-40 overflow-hidden rounded-full bg-white/10 sm:w-56">
            <div className="footer-line-glow h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-cyan-400/90 to-transparent blur-[0.5px]" />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
