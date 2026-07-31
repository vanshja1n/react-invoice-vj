import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Check, Rocket, Sparkles } from 'lucide-react';
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

  const features = [
    'Unlimited invoices',
    'Unlimited products & inventory',
    'Unlimited customers',
    'Cloud sync across devices',
    'PDF generation & ZIP export',
    'Multi-currency support',
    'Priority email support',
    'Advanced analytics & reports',
    'Custom invoice templates',
    'Team collaboration (upcoming)',
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription"
        description="Manage your InvoiceHub plan and billing."
      />

      <div className="mx-auto w-full max-w-5xl">
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/20">
          <CardContent className="p-8 md:p-10">
            <div className="flex flex-col lg:flex-row lg:items-center gap-8">
              <div className="flex-1 space-y-5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3 w-3" />
                  InvoiceHub Premium
                </div>

                <div>
                  <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                    Everything you need,{' '}
                    <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                      nothing you don&apos;t
                    </span>
                  </h2>
                  <p className="mt-3 text-sm text-muted-foreground md:text-base">
                    Unlock the full power of InvoiceHub with automatic cloud sync, priority support, and upcoming premium features.
                  </p>
                </div>

                <div className="flex items-end gap-2">
                  <span className="text-5xl font-extrabold tracking-tight">₹500</span>
                  <span className="pb-2 text-base text-muted-foreground">/ month</span>
                </div>

                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 pt-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                      <span className="text-foreground/80">{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-4 flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    disabled
                    className="h-10 px-6 gap-2"
                  >
                    <Rocket className="h-4 w-4" />
                    Coming Soon
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Premium subscription launching soon. Stay on the free plan until then.
                  </p>
                </div>
              </div>

              <div className="w-full lg:w-80 shrink-0">
                <div className="rounded-xl border bg-card shadow-sm">
                  <div className="p-5 border-b border-border">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        Current plan
                      </p>
                      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                        {plan === 'premium' ? 'Premium' : 'Free'}
                      </span>
                    </div>
                    <p className="mt-4 text-2xl font-bold">
                      {plan === 'premium' ? 'InvoiceHub Premium' : 'InvoiceHub Free'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan === 'premium' ? 'Billed monthly at ₹500' : 'No charge — full offline access'}
                    </p>
                  </div>
                  <div className="p-5 space-y-3 text-xs">
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Cloud sync</span>
                      <span className="text-foreground">{isAuthenticated ? 'Enabled' : 'Login to enable'}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Invoices</span>
                      <span className="text-foreground">Unlimited</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Support</span>
                      <span className="text-foreground">Standard</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
