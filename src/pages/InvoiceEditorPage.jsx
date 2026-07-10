import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Save, Eye, Download, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InvoiceHeader } from '@/components/invoice/InvoiceHeader';
import { ClientDetails } from '@/components/invoice/ClientDetails';
import { InvoiceItems } from '@/components/invoice/InvoiceItems';
import { InvoiceSummary } from '@/components/invoice/InvoiceSummary';
import { InvoiceFooter } from '@/components/invoice/InvoiceFooter';
import { FormSkeleton } from '@/components/shared/LoadingSkeleton';
import {
  createDefaultInvoice,
  calculateInvoiceTotals,
  generateInvoiceNumber,
  INVOICE_STATUS,
} from '@/types/invoice';
import { createInvoice, updateInvoice, getInvoice, getLastInvoiceNumber } from '@/services/db';
import { getSettings } from '@/services/settings';

export default function InvoiceEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Initialize invoice
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (isEditing) {
          const existing = await getInvoice(parseInt(id, 10));
          if (existing) {
            setInvoice(existing);
          } else {
            toast.error('Invoice not found');
            navigate('/invoices');
            return;
          }
        } else {
          const settings = getSettings();
          const lastNum = await getLastInvoiceNumber();
          const defaultInvoice = createDefaultInvoice(settings);
          defaultInvoice.invoiceNumber = generateInvoiceNumber(lastNum);
          setInvoice(defaultInvoice);
        }
      } catch (e) {
        console.error('Failed to load invoice:', e);
        toast.error('Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, isEditing, navigate]);

  // Update invoice field(s)
  const updateField = useCallback((updates) => {
    setInvoice((prev) => {
      const updated = { ...prev, ...updates };

      // Recalculate if items or rates changed
      if (updates.items || updates.taxRate !== undefined || updates.discountRate !== undefined || updates.shippingCharges !== undefined) {
        const items = updates.items || prev.items;
        const taxRate = updates.taxRate !== undefined ? updates.taxRate : prev.taxRate;
        const discountRate = updates.discountRate !== undefined ? updates.discountRate : prev.discountRate;
        const shippingCharges = updates.shippingCharges !== undefined ? updates.shippingCharges : prev.shippingCharges;
        const totals = calculateInvoiceTotals(items, taxRate, discountRate, shippingCharges);
        Object.assign(updated, totals);
      }

      return updated;
    });
  }, []);

  // Recalculate totals whenever items change
  const handleItemsChange = useCallback((newItems) => {
    updateField({ items: newItems });
  }, [updateField]);

  // Save invoice
  const handleSave = async (status) => {
    if (!invoice) return;

    setSaving(true);
    try {
      const dataToSave = {
        ...invoice,
        status: status || invoice.status,
        clientName: invoice.clientName,
        companyName: invoice.companyName,
        amount: invoice.total,
      };

      if (isEditing) {
        await updateInvoice(parseInt(id, 10), dataToSave);
        setInvoice({ ...dataToSave, id: parseInt(id, 10) });
        toast.success('Invoice updated successfully');
      } else {
        const saved = await createInvoice(dataToSave);
        toast.success('Invoice saved successfully');
        navigate(`/invoices/${saved.id}/edit`, { replace: true });
      }
    } catch (e) {
      console.error('Failed to save:', e);
      toast.error('Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <FormSkeleton />
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {isEditing ? 'Edit Invoice' : 'New Invoice'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {invoice.invoiceNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status */}
          <Select
            value={invoice.status}
            onValueChange={(v) => updateField({ status: v })}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INVOICE_STATUS.DRAFT}>
                <span className="flex items-center gap-1.5">Draft</span>
              </SelectItem>
              <SelectItem value={INVOICE_STATUS.PENDING}>
                <span className="flex items-center gap-1.5">Pending</span>
              </SelectItem>
              <SelectItem value={INVOICE_STATUS.PAID}>
                <span className="flex items-center gap-1.5">Paid</span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={() => {
              handleSave().then(() => {
                if (isEditing) {
                  navigate(`/invoices/${id}/preview`);
                }
              });
            }}
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>

          <Button
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={() => handleSave()}
            disabled={saving}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <InvoiceHeader data={invoice} onChange={updateField} />
            <ClientDetails data={invoice} onChange={updateField} />
          </div>
          <div className="space-y-4">
            <InvoiceSummary data={invoice} onChange={updateField} />
          </div>
        </div>

        <InvoiceItems
          items={invoice.items}
          currency={invoice.currency}
          onChange={handleItemsChange}
        />

        <InvoiceFooter data={invoice} onChange={updateField} />
      </div>
    </motion.div>
  );
}
