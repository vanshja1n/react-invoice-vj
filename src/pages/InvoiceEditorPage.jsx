import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Save, Eye, ArrowLeft } from 'lucide-react';
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
import { SaveCustomItemsAsProductsDialog } from '@/components/invoice/SaveCustomItemsAsProductsDialog';
import { FormSkeleton } from '@/components/shared/LoadingSkeleton';
import {
  createDefaultInvoice,
  calculateInvoiceTotals,
  generateInvoiceNumber,
  prepareInvoiceForSave,
  validateInvoiceItems,
  INVOICE_STATUS,
} from '@/types/invoice';
import {
  createDefaultProduct,
} from '@/types/product';
import { getInvoice, getLastInvoiceNumber, getAllProducts } from '@/services/db';
import { getSettings } from '@/services/settings';
import { useInvoices } from '@/hooks/useInvoices';
import { useProducts } from '@/hooks/useProducts';
import { TEMPLATE_LIST, getDefaultTemplateId } from '@/services/templateService';

export default function InvoiceEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const { add, update } = useInvoices();
  const { products, add: addProduct } = useProducts();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customItemsDialogOpen, setCustomItemsDialogOpen] = useState(false);
  const [pendingCustomItems, setPendingCustomItems] = useState([]);

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
          defaultInvoice.template = getDefaultTemplateId();
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

  const updateField = useCallback((updates) => {
    console.log("[InvoiceEditor.updateField] called with updates:", updates);
    setInvoice((prev) => {
      console.log("[InvoiceEditor.updateField] prev invoice items:", prev?.items?.map(i => ({ id: i.id, quantity: i.quantity, typeof_quantity: typeof i.quantity })));
      console.log('[InvoiceEditor][STATE BEFORE]', prev);
      
      // Create a new updated object
      const updated = { ...prev, ...updates };

      if (updates.items || updates.taxRate !== undefined || updates.discountRate !== undefined || updates.shippingCharges !== undefined) {
        // Get the items (either from updates or previous state)
        const itemsToUse = updates.items || prev.items;
        console.log("[InvoiceEditor.updateField] items for calculation:", itemsToUse?.map(i => ({ id: i.id, quantity: i.quantity, typeof_quantity: typeof i.quantity })));
        
        const taxRate = updates.taxRate !== undefined ? updates.taxRate : prev.taxRate;
        const discountRate = updates.discountRate !== undefined ? updates.discountRate : prev.discountRate;
        const shippingCharges = updates.shippingCharges !== undefined ? updates.shippingCharges : prev.shippingCharges;
        const totals = calculateInvoiceTotals(itemsToUse, taxRate, discountRate, shippingCharges);
        // Merge the totals into our updated invoice
        Object.assign(updated, totals);
      }

      console.log("[InvoiceEditor.updateField] returning updated invoice, items:", updated?.items?.map(i => ({ id: i.id, quantity: i.quantity, typeof_quantity: typeof i.quantity })));
      console.log('[InvoiceEditor][STATE AFTER]', updated);
      return updated;
    });
  }, []);

  const handleItemsChange = useCallback((newItems) => {
    console.log("[InvoiceEditor.handleItemsChange] called with newItems:", newItems.map(i => ({ id: i.id, quantity: i.quantity, typeof_quantity: typeof i.quantity })));
    console.log('[InvoiceEditor][PARENT ITEMS]', newItems);
    updateField({ items: newItems });
  }, [updateField]);

  const handleSaveCustomItemsAsProducts = async (items) => {
    items.forEach(async (item) => {
      const newProduct = {
        ...createDefaultProduct(),
        name: item.name,
        description: item.description,
        unit: item.unit,
        sellingPrice: parseFloat(item.price),
      };
      try {
        await addProduct(newProduct);
        toast.success(`Product "${item.name}" added successfully!`);
      } catch (e) {
        console.error('Failed to add product:', e);
        toast.error(`Failed to add product "${item.name}"`);
      }
    });
  };

  const handleSave = async () => {
    if (!invoice) return;

    const validation = validateInvoiceItems(invoice);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    setSaving(true);
    try {
      const dataToSave = prepareInvoiceForSave(invoice);
      let savedInvoice;

      if (isEditing) {
        savedInvoice = await update(parseInt(id, 10), dataToSave);
        setInvoice({ ...dataToSave, id: parseInt(id, 10) });
        toast.success('Invoice updated successfully');
      } else {
        savedInvoice = await add(dataToSave);
        toast.success('Invoice saved successfully');
        navigate(`/invoices/${savedInvoice.id}/edit`, { replace: true });
      }

      // Find custom items
      const customItems = dataToSave.items.filter(item =>
        !item.productId && item.name.trim());
      if (customItems.length > 0) {
        // Check if any of these names already exist in products
        const existingProductNames = new Set(products.map(p => p.name.toLowerCase()));
        const newCustomItems = customItems.map(item => ({
          ...item,
          currency: dataToSave.currency,
        })).filter(item =>
          !existingProductNames.has(item.name.toLowerCase()));
        
        if (newCustomItems.length > 0) {
          setPendingCustomItems(newCustomItems);
          setCustomItemsDialogOpen(true);
        }
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
          <Select
            value={invoice.status}
            onValueChange={(v) => updateField({ status: v })}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INVOICE_STATUS.DRAFT}>Draft</SelectItem>
              <SelectItem value={INVOICE_STATUS.SENT}>Sent</SelectItem>
              <SelectItem value={INVOICE_STATUS.PENDING}>Pending</SelectItem>
              <SelectItem value={INVOICE_STATUS.PAID}>Paid</SelectItem>
              <SelectItem value={INVOICE_STATUS.CANCELLED}>Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">Template</span>
            <Select
              value={invoice.template || getDefaultTemplateId()}
              onValueChange={(v) => updateField({ template: v })}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_LIST.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

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

      <SaveCustomItemsAsProductsDialog
        open={customItemsDialogOpen}
        onOpenChange={setCustomItemsDialogOpen}
        customItems={pendingCustomItems}
        onSave={handleSaveCustomItemsAsProducts}
      />
    </motion.div>
  );
}
