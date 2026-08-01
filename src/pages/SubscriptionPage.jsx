import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Bell, Sparkles, TrendingUp, DollarSign, FileText, Users, Package, AlertTriangle, BarChart3, PieChart, LineChart, Receipt } from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export default function SubscriptionPage() {
  const { isAuthenticated } = useAuth();
  const [plan, setPlan] = useState('free');

  useEffect(() => {
    if (isAuthenticated) {
      api.subscriptions.get().then((s) => setPlan(s.plan || 'free')).catch(() => {});
    }
  }, [isAuthenticated]);

  const handleNotify = (planName) => {
    toast.success(`InvoiceHub ${planName} is coming soon.`);
  };

  const reportCards = [
    { icon: DollarSign, label: 'Total Revenue', color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { icon: TrendingUp, label: 'Total Profit', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { icon: FileText, label: 'Total Invoices', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { icon: BarChart3, label: 'Average Invoice Value', color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { icon: Users, label: 'Top Customers', color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { icon: Package, label: 'Top Selling Products', color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { icon: AlertTriangle, label: 'Lowest Stock Products', color: 'text-red-500', bg: 'bg-red-500/10' },
    { icon: TrendingUp, label: 'Revenue Growth', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { icon: LineChart, label: 'Monthly Revenue Chart', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { icon: PieChart, label: 'Monthly Profit Chart', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { icon: Receipt, label: 'Tax Summary', color: 'text-teal-500', bg: 'bg-teal-500/10' },
  ];

  return (
    <div className="space-y-12">
      <PageHeader
        title="Subscription"
        description="Choose the perfect plan for your business needs."
      />

      {/* Pricing Cards */}
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="h-full border-border/50 hover:border-border transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-lg">Free</CardTitle>
                  <Badge variant="secondary" className="text-xs">Current Plan</Badge>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">₹0</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <CardDescription className="mt-2">
                  Perfect for personal use and offline invoicing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {['Unlimited invoices', 'Unlimited customers', 'Unlimited products', 'Offline mode', 'PDF generation', 'Local backup & restore', 'Basic support'].map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button disabled variant="outline" className="w-full mt-4">
                  Current Plan
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Pro Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="h-full border-border/50 hover:border-border transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-lg">Pro</CardTitle>
                  <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">₹499</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <CardDescription className="mt-2">
                  Ideal for freelancers and small businesses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {['Everything in Free', 'Cloud Sync', 'Access from multiple devices', 'Automatic backup', 'Invoice templates', 'Multi-currency support', 'Priority email support'].map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full mt-4 gap-2" onClick={() => handleNotify('Pro')}>
                  <Bell className="h-4 w-4" />
                  Notify Me
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Business Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="h-full relative border-primary/30 shadow-lg shadow-primary/5 hover:shadow-primary/10 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent rounded-xl pointer-events-none" />
              <CardHeader className="pb-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    Business
                    <Sparkles className="h-4 w-4 text-primary" />
                  </CardTitle>
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">Coming Soon</Badge>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">₹4,999</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <CardDescription className="mt-2">
                  Designed for growing businesses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 relative">
                <ul className="space-y-3">
                  {['Everything in Pro', 'Monthly Founder Report', 'Revenue analytics', 'Profit & Margin analytics', 'Top-selling products', 'Top customers', 'Inventory insights', 'GST / Tax reports', 'CSV & Excel exports', 'White-label invoices (Coming Soon)', 'Team collaboration (Coming Soon)', 'API Access (Coming Soon)', 'Dedicated founder support'].map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full mt-4 gap-2" onClick={() => handleNotify('Business')}>
                  <Bell className="h-4 w-4" />
                  Notify Me
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Monthly Founder Report Section */}
      <div className="mx-auto w-full max-w-6xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Monthly Founder Report</h2>
          <p className="text-muted-foreground text-sm">
            Automatically generated and emailed at the end of every month.
          </p>
        </div>
        
        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {reportCards.map((card, index) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className={`rounded-lg p-2 ${card.bg}`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <span className="text-sm font-medium text-foreground/80">{card.label}</span>
                </motion.div>
              ))}
            </div>
            
            <div className="mt-6 pt-6 border-t border-border/30 text-center">
              <p className="text-sm text-muted-foreground">
                Available with the <span className="text-primary font-medium">Business Plan</span>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
