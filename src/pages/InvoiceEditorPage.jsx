import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Save, Eye, ArrowLeft, Ban } from 'lucide-react';
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
  validateInvoiceTotals,
  filterValidItems,
  INVOICE_STATUS,
} from '@/types/invoice';
import {
  createDefaultProduct,
} from '@/types/product';
import { getLastInvoiceNumber, normalizeId } from '@/services/db';
import { getSettings } from '@/services/settings';
import { useInvoices } from '@/hooks/useInvoices';
import { useProducts } from '@/hooks/useProducts';
import { TEMPLATE_LIST, getDefaultTemplateId } from '@/services/templateService';
import { loadInvoiceWithValidation } from '@/services/invoiceService';

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
  const _saveInFlightRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (isEditing) {
          console.info('[InvoiceEditorPage] TRACE load start', { routeId: id, routeIdType: typeof id, routeIdLength: String(id).length });
          
          // CRITICAL FIX: Use centralized invoice service with validation
          const result = await loadInvoiceWithValidation(id, { 
            trace: 'InvoiceEditorPage', 
            prepareForRender: false, // Don't prepare for render in edit mode
            retries: 4 
          });
          
          if (result.success) {
            console.info('[InvoiceEditorPage] TRACE load OK', { 
              routeId: id, 
              resolvedId: result.invoice.id, 
              resolvedIdType: typeof result.invoice.id, 
              invoiceNumber: result.invoice.invoiceNumber,
              total: result.invoice.total,
              itemCount: result.invoice.items?.length
            });

            // Backward-compat heal: if the stored invoice is missing subTotal
            // (created before the schema was fixed) recalculate all totals from
            // line items so the editor and validation always have complete data.
            let loaded = result.invoice;
            const hasSubTotal =
              (typeof loaded.subTotal === 'number' && !isNaN(loaded.subTotal)) ||
              (typeof loaded.subtotal === 'number' && !isNaN(loaded.subtotal));
            if (!hasSubTotal) {
              const validItems = filterValidItems(loaded.items || []);
              const healed = calculateInvoiceTotals(
                validItems, loaded.taxRate, loaded.discountRate, loaded.shippingCharges,
              );
              loaded = {
                ...loaded,
                subTotal: healed.subTotal,
                subtotal: healed.subTotal,
                taxAmount: healed.taxAmount,
                discountAmount: healed.discountAmount,
                total: healed.total,
                amount: healed.total,
                grandTotal: healed.total,
              };
              console.info('[InvoiceEditorPage] Healed missing totals from line items', {
                invoiceNumber: loaded.invoiceNumber,
                healedSubTotal: healed.subTotal,
                healedTotal: healed.total,
              });
            }

            setInvoice(loaded);
          } else {
            console.error('[InvoiceEditorPage] TRACE load FAILED', { 
              routeId: id, 
              reason: result.reason 
            });
            toast.error(`Invoice not found: ${result.reason}`);
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
        console.error('[InvoiceEditorPage] Failed to load invoice:', e?.message || String(e));
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

  const handleSave = useCallback(async () => {
    if (!invoice) return undefined;
    if (_saveInFlightRef.current) return undefined;

    // CRITICAL FIX: Allow cancelled invoices to be edited and status changed
    // Users should be able to change status from Cancelled back to Paid or any other status
    // Removed the restriction that prevented saving cancelled invoices

    _saveInFlightRef.current = true;

    console.log('[INVOICE-SAVE] Starting save process', { 
      invoiceNumber: invoice.invoiceNumber, 
      itemCount: invoice.items?.length,
      currentTotal: invoice.total,
      currentSubtotal: invoice.subTotal
    });

    const validation = validateInvoiceItems(invoice);
    if (!validation.valid) {
      _saveInFlightRef.current = false;
      toast.error(validation.message);
      return undefined;
    }

    // Recalculate totals from line items before saving to ensure consistency.
    // validateInvoiceTotals logs warnings on mismatch but never blocks the save.
    validateInvoiceTotals(invoice);

    setSaving(true);
    try {
      const dataToSave = prepareInvoiceForSave(invoice);
      
      console.log('[INVOICE-SAVE] Prepared data for save', {
        invoiceNumber: dataToSave.invoiceNumber,
        itemCount: dataToSave.items?.length,
        calculatedTotal: dataToSave.total,
        calculatedSubtotal: dataToSave.subTotal,
        items: dataToSave.items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity }))
      });
      
      let savedInvoice;

      if (isEditing) {
        savedInvoice = await update(id, dataToSave);
        setInvoice({ ...dataToSave, id: normalizeId(id) });
        toast.success('Invoice updated successfully');
      } else {
        savedInvoice = await add(dataToSave);
        toast.success('Invoice saved successfully');
        if (savedInvoice?.id != null) {
          const next = `/invoices/${savedInvoice.id}/edit`;
          setTimeout(() => navigate(next, { replace: true }), 0);
        }
      }

      console.log('[INVOICE-SAVE] Save successful', { 
        invoiceId: savedInvoice?.id, 
        invoiceNumber: savedInvoice?.invoiceNumber,
        savedTotal: savedInvoice?.total 
      });

      // Find custom items
      const customItems = dataToSave.items.filter(item =>
        !item.productId && item.name.trim());
      if (customItems.length > 0) {
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
      return savedInvoice;
    } catch (e) {
      console.error('[INVOICE-SAVE] Failed to save:', e);
      toast.error('Failed to save invoice');
      return undefined;
    } finally {
      setSaving(false);
      _saveInFlightRef.current = false;
    }
  }, [invoice, isEditing, id, update, add, products]);

  const handlePreview = useCallback(async () => {
    const validation = validateInvoiceItems(invoice);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }
    const savedInvoice = await handleSave();
    const targetId = savedInvoice?.id ?? (isEditing ? id : undefined);
    if (targetId) {
      navigate(`/invoices/${targetId}/preview`);
    } else if (isEditing && id) {
      navigate(`/invoices/${id}/preview`);
    }
  }, [invoice, handleSave, isEditing, id, navigate]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <FormSkeleton />
      </div>
    );
  }

  if (!invoice) return null;

  const isCancelled = invoice.status === INVOICE_STATUS.CANCELLED;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto"
    >
      {/* Cancelled invoice informational banner */}
      {isCancelled && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
          <Ban className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            This invoice is <strong>cancelled</strong>. You can edit it and change the status back to Paid or any other status.
          </span>
        </div>
      )}

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
          {/* Status selector — always enabled to allow status changes */}
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
            onClick={handlePreview}
            disabled={saving || loading}
          >
            <Eye className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Preview'}
          </Button>

          <Button
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={handleSave}
            disabled={saving || loading}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          )}
        </div>
      </div>

      <div className={`space-y-4 ${isCancelled ? 'pointer-events-none opacity-60 select-none' : ''}`}>
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
