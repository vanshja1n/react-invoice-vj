import { useState } from 'react';
import { Cloud, CloudSync, Loader2, CloudUpload, Database, FolderOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SummaryLine = ({ icon: Icon, title, subtitle, tone = 'default' }) => (
  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
    <Icon className={`h-4 w-4 shrink-0 ${tone === 'warning' ? 'text-amber-600' : 'text-primary'}`} />
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-medium text-foreground">{title}</p>
      {subtitle && (
        <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>
      )}
    </div>
  </div>
);

function CountsChip({ counts, label }) {
  if (!counts) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-muted-foreground/30 bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground">
        {label}: —
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] text-foreground">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">
        {counts.invoices || 0} inv · {counts.products || 0} prod · {counts.customers || 0} cust · {counts.inventoryHistory || 0} hist
      </span>
    </div>
  );
}

export function SyncChoiceDialog({ open, onOpenChange, onComplete, localCounts, cloudCounts }) {
  const { syncing, handleSyncChoice } = useAuth();
  const [choice, setChoice] = useState(null);

  const choose = async (mode) => {
    if (syncing) return;
    setChoice(mode);
    try {
      await handleSyncChoice(mode);
      toast.success('Sync complete — your workspace is now linked.');
      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      const msg = err?.message || 'Sync operation failed. Guest data is preserved — please retry.';
      toast.error(msg, { duration: 7000 });
    } finally {
      setChoice(null);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const OptionCard = ({ icon: Icon, title, description, onClick, disabled, active, recommended }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left rounded-lg border p-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed relative ${
        active
          ? 'border-primary bg-accent/50 ring-1 ring-primary/50'
          : 'border-border hover:border-ring hover:bg-accent/30'
      }`}
    >
      {recommended && (
        <span className="absolute right-3 top-3 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
          Recommended
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 pr-16">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  );

  const handleCancel = () => {
    if (syncing) return;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !syncing && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-lg font-semibold">Sync this device with your cloud workspace</DialogTitle>
          <DialogDescription className="mt-1.5 text-xs">
            We found invoices, products, or customers on this device and existing data in your cloud account.
            Choose how to combine them. Your local guest data is preserved until the chosen operation succeeds.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <SummaryLine
              icon={FolderOpen}
              title="Guest workspace (this device)"
              subtitle={
                localCounts
                  ? `${localCounts.invoices || 0} invoices · ${localCounts.products || 0} products · ${localCounts.customers || 0} customers`
                  : 'Counting local data…'
              }
              tone="warning"
            />
            <SummaryLine
              icon={Database}
              title="Cloud workspace (MongoDB)"
              subtitle={
                cloudCounts
                  ? `${cloudCounts.invoices || 0} invoices · ${cloudCounts.products || 0} products · ${cloudCounts.customers || 0} customers`
                  : 'Waiting to compare with cloud…'
              }
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <CountsChip counts={localCounts} label="Guest" />
            <CountsChip counts={cloudCounts} label="Cloud" />
          </div>
        </div>

        <div className="px-6 py-5 space-y-2.5">
          <OptionCard
            icon={CloudSync}
            title="Merge guest data with cloud"
            description="Combine the local work on this device with what's already in your cloud account. Duplicates are resolved using the most recent version of each item."
            onClick={() => choose('merge')}
            disabled={syncing}
            active={choice === 'merge'}
            recommended
          />
          <OptionCard
            icon={Cloud}
            title="Keep cloud data"
            description="Discard the local guest workspace on this device and use your existing cloud data. Nothing in the cloud will be changed."
            onClick={() => choose('cloud')}
            disabled={syncing}
            active={choice === 'cloud'}
          />
          <OptionCard
            icon={CloudUpload}
            title="Replace cloud data with guest data"
            description="Overwrite your entire cloud workspace with what is on this device. Existing cloud records will be replaced by the local guest workspace."
            onClick={() => choose('replace-cloud')}
            disabled={syncing}
            active={choice === 'replace-cloud'}
          />
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={syncing}
            className="h-8"
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => choose('merge')}
              disabled={syncing}
              className="h-8"
            >
              {syncing && choice !== 'merge' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Use default merge
            </Button>
            <Button
              size="sm"
              onClick={() => choose(syncing ? choice || 'merge' : 'merge')}
              disabled={syncing}
              className="h-8 min-w-[120px]"
            >
              {syncing && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {syncing ? 'Syncing…' : 'Sync workspace'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SyncChoiceDialog;
