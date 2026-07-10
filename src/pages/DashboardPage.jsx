import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  CheckCircle2,
  Clock,
  FilePen,
  DollarSign,
  Plus,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { DashboardSkeleton } from '@/components/shared/LoadingSkeleton';
import { useInvoices } from '@/hooks/useInvoices';
import { formatCurrency } from '@/types/invoice';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const PIE_COLORS = ['hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(220, 9%, 46%)'];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { invoices, loading, stats, getMonthlyRevenue } = useInvoices();
  const [monthlyData, setMonthlyData] = useState([]);

  useEffect(() => {
    getMonthlyRevenue().then(setMonthlyData);
  }, [invoices, getMonthlyRevenue]);

  if (loading) return <DashboardSkeleton />;

  const statCards = [
    {
      label: 'Total Invoices',
      value: stats?.total || 0,
      icon: FileText,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Paid',
      value: stats?.paid || 0,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Pending',
      value: stats?.pending || 0,
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Draft',
      value: stats?.draft || 0,
      icon: FilePen,
      color: 'text-zinc-500',
      bg: 'bg-zinc-500/10',
    },
  ];

  const pieData = [
    { name: 'Paid', value: stats?.paid || 0 },
    { name: 'Pending', value: stats?.pending || 0 },
    { name: 'Draft', value: stats?.draft || 0 },
  ].filter(d => d.value > 0);

  const recentInvoices = invoices.slice(0, 5);

  const currency = invoices.length > 0 ? invoices[0].currency || '₹' : '₹';

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your invoice activity"
      >
        <Button onClick={() => navigate('/invoices/new')} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New Invoice
        </Button>
      </PageHeader>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <motion.div key={s.label} variants={item}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">{s.label}</p>
                      <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                    </div>
                    <div className={`rounded-xl p-2.5 ${s.bg}`}>
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Revenue Card */}
        <motion.div variants={item}>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Total Revenue</p>
                  <p className="text-3xl font-bold tracking-tight">
                    {formatCurrency(stats?.totalRevenue || 0, currency)}
                  </p>
                </div>
                <div className="rounded-xl p-2.5 bg-violet-500/10">
                  <DollarSign className="h-5 w-5 text-violet-500" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                {formatCurrency(stats?.paidRevenue || 0, currency)} collected
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue Chart */}
          <motion.div variants={item} className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Monthly Revenue</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(248 70% 60%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(248 70% 60%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                      <ReTooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid hsl(var(--border))',
                          backgroundColor: 'hsl(var(--popover))',
                          color: 'hsl(var(--popover-foreground))',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(248 70% 60%)"
                        strokeWidth={2}
                        fill="url(#revenueGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
                    No revenue data yet
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Status Pie */}
          <motion.div variants={item}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Invoice Status</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {pieData.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <ReTooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid hsl(var(--border))',
                            backgroundColor: 'hsl(var(--popover))',
                            color: 'hsl(var(--popover-foreground))',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 mt-2">
                      {pieData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-1.5 text-xs">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: PIE_COLORS[i] }}
                          />
                          {d.name} ({d.value})
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
                    No invoices yet
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Recent Invoices */}
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Recent Invoices</CardTitle>
                {invoices.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => navigate('/invoices')}
                  >
                    View All <ArrowUpRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {recentInvoices.length > 0 ? (
                <div className="space-y-3">
                  {recentInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {inv.invoiceNumber || 'Draft'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {inv.clientName || 'No client'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <StatusBadge status={inv.status} />
                        <span className="text-sm font-semibold whitespace-nowrap">
                          {formatCurrency(inv.total, inv.currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No invoices yet"
                  description="Create your first invoice to get started"
                  actionLabel="Create Invoice"
                  onAction={() => navigate('/invoices/new')}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={item}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Create Invoice',
                desc: 'Start a new invoice',
                icon: FilePen,
                color: 'text-blue-500 bg-blue-500/10',
                to: '/invoices/new',
              },
              {
                label: 'View History',
                desc: 'Browse all invoices',
                icon: FileText,
                color: 'text-violet-500 bg-violet-500/10',
                to: '/invoices',
              },
              {
                label: 'Export Backup',
                desc: 'Download your data',
                icon: ArrowUpRight,
                color: 'text-emerald-500 bg-emerald-500/10',
                to: '/backup',
              },
            ].map((action) => (
              <Card
                key={action.label}
                className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5"
                onClick={() => navigate(action.to)}
              >
                <CardContent className="pt-5 pb-4 px-5">
                  <div className={`inline-flex rounded-xl p-2.5 mb-3 ${action.color}`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-sm">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
