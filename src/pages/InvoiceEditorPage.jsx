import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
import { getLastInvoiceNumber, normalizeId, getCustomer, getAllCustomers, updateInvoice } from '@/services/db';
import { getSettings } from '@/services/settings';
import { useInvoices } from '@/hooks/useInvoices';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers } from '@/hooks/useCustomers';
import { TEMPLATE_LIST, getDefaultTemplateId } from '@/services/templateService';
import { loadInvoiceWithValidation } from '@/services/invoiceService';

export default function InvoiceEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEditing = !!id;
  const { add, update } = useInvoices();
  const { products, add: addProduct } = useProducts();
  const { add: addCustomer, update: updateCustomer } = useCustomers();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customItemsDialogOpen, setCustomItemsDialogOpen] = useState(false);
  const [pendingCustomItems, setPendingCustomItems] = useState([]);
  // When the user clicks Preview and new custom items need to be saved as
  // products first, we can't navigate immediately — the dialog must close
  // first.  This ref holds the navigate target so we can fire it from the
  // dialog's onOpenChange callback instead.
  const _pendingPreviewNavRef = useRef(null);
  const _saveInFlightRef = useRef(false);
  // Guard against React StrictMode double-invoking the load effect in dev.
  const _loadRanRef = useRef(false);

  useEffect(() => {
    // React StrictMode mounts → unmounts → remounts in development, causing
    // this effect to run twice with the same id.  The second run is a no-op
    // guard: we track whether we already started loading for this (id, mount)
    // cycle via _loadRanRef and skip the duplicate.
    if (_loadRanRef.current) return;
    _loadRanRef.current = true;

    const init = async () => {
      setLoading(true);
      try {
        if (isEditing) {
          // ── Fast path: Preview page passed the invoice back via nav state ──
          // This avoids a DB lookup entirely when returning from Preview,
          // eliminating the window where processQueue may have rewritten the
          // local integer id to a MongoDB ObjectId.
          const stateInvoice = location.state?.invoice ?? null;
          if (stateInvoice) {
            console.info('[EDITOR] Using navigation state invoice', {
              routeId: id,
              invoiceId: stateInvoice.id,
              invoiceNumber: stateInvoice.invoiceNumber,
            });
            setInvoice(stateInvoice);
            return;
          }

          console.info('[EDITOR] Fallback DB lookup', { routeId: id, routeIdType: typeof id });

          const result = await loadInvoiceWithValidation(id, { 
            trace: 'InvoiceEditorPage', 
            prepareForRender: false,
            retries: 4 
          });
          
          if (!result.found) {
            console.error('[EDITOR] Final not found', { routeId: id, reason: result.reason });
            toast.error('Invoice not found');
            navigate('/invoices');
            return;
          }

          if (!result.success) {
            console.warn('[EDITOR] Retry after refresh — opened with integrity warning', {
              routeId: id,
              reason: result.reason,
              invoiceNumber: result.invoice?.invoiceNumber,
            });
            toast.warning(`Invoice opened with a data warning: ${result.reason}`);
          } else {
            console.info('[EDITOR] DB lookup OK', { 
              routeId: id, 
              resolvedId: result.invoice.id, 
              invoiceNumber: result.invoice.invoiceNumber,
              total: result.invoice.total,
              itemCount: result.invoice.items?.length
            });
          }

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

    // Reset the guard when the route id changes so a genuine navigation to a
    // different invoice always triggers a fresh load.
    return () => { _loadRanRef.current = false; };
  }, [id, isEditing, location.state, navigate]);

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
    // CRITICAL: must use a proper for...of loop with await, NOT forEach.
    //
    // forEach does NOT await async callbacks — it fires each iteration
    // synchronously and returns immediately, so the awaited addProduct()
    // calls run detached from the caller.  The consequences are:
    //
    //   1. addProduct() completes AFTER the component may have already
    //      navigated away (Preview path), causing the products:create queue
    //      entry to be added to a dead in-memory state while the new page
    //      (InvoicePreviewPage) is already mounted.
    //
    //   2. useProducts._addBusyRef is released before the next iteration
    //      starts, but because the awaits are detached there is no ordering
    //      guarantee — concurrent addProduct() calls for multiple items can
    //      race, causing the _addBusyRef guard to throw "already in progress".
    //
    //   3. If navigation fires before the async work finishes, the component
    //      unmounts and the sync engine's next tick may capture the queue
    //      snapshot BEFORE the products:create entries are written to
    //      localStorage, so they are never processed and never reach MongoDB.
    //
    // Using for...of with await ensures each product is fully committed to
    // IndexedDB and the sync queue before the next one starts, and before
    // the dialog's onOpenChange triggers navigation.
    console.log('[INVOICE-PRODUCT] Saving new products from invoice dialog', {
      count: items.length,
      names: items.map(i => i.name),
    });
    for (const item of items) {
      const newProduct = {
        ...createDefaultProduct(),
        name: item.name,
        description: item.description,
        unit: item.unit,
        sellingPrice: parseFloat(item.price),
      };
      try {
        console.log('[INVOICE-PRODUCT] Saving new product', { name: item.name });
        const saved = await addProduct(newProduct);
        console.log('[INVOICE-PRODUCT] Product committed to IndexedDB and queue', {
          name: saved?.name,
          localId: saved?.id,
        });
        toast.success(`Product "${item.name}" added successfully!`);
      } catch (e) {
        console.error('[INVOICE-PRODUCT] Failed to add product', { name: item.name, error: e?.message || String(e) });
        toast.error(`Failed to add product "${item.name}"`);
      }
    }
    console.log('[INVOICE-PRODUCT] All products saved — navigation can now proceed');
  };

  const handleSave = useCallback(async () => {
    if (!invoice) return undefined;
    if (_saveInFlightRef.current) {
      console.log('[SAVE] Already running, skipping duplicate');
      return undefined;
    }

    _saveInFlightRef.current = true;
    console.log('[SAVE] Started', {
      invoiceNumber: invoice.invoiceNumber,
      itemCount: invoice.items?.length,
      currentTotal: invoice.total,
    });

    const validation = validateInvoiceItems(invoice);
    if (!validation.valid) {
      _saveInFlightRef.current = false;
      toast.error(validation.message);
      return undefined;
    }

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
          navigate(`/invoices/${savedInvoice.id}/edit`, { replace: true });
        }
      }

      console.log('[SAVE] Completed', { 
        invoiceId: savedInvoice?.id, 
        invoiceNumber: savedInvoice?.invoiceNumber,
        savedTotal: savedInvoice?.total 
      });

      // ── Auto-create or update the customer record ────────────────────
      // After invoice save, ensure the client details typed into the form
      // are persisted as a proper customer record in IndexedDB.
      //
      // Priority of match: email → phone → name (case-insensitive).
      // All operations are best-effort — a failure here never breaks the
      // invoice that has already been saved successfully.
      try {
        const clientName    = (dataToSave.clientName    || '').trim();
        const clientEmail   = (dataToSave.clientEmail   || '').trim();
        const clientPhone   = (dataToSave.clientPhone   || '').trim();
        const clientGst     = (dataToSave.clientGst     || '').trim();
        const billingAddress = (dataToSave.billingAddress || '').trim();

        // Only proceed when there is at least a name to identify the customer.
        if (clientName) {
          // Helper: build the non-empty patch for GST / address fields.
          const _buildPatch = (base) => {
            const patch = {};
            if (clientName  && (!base.name  || base.name  !== clientName))  patch.name  = clientName;
            if (clientEmail && (!base.email || base.email !== clientEmail))  patch.email = clientEmail;
            if (clientPhone && (!base.phone || base.phone !== clientPhone))  patch.phone = clientPhone;
            // Never overwrite an existing non-empty value with a blank.
            if (clientGst      && !base.gstNumber) patch.gstNumber = clientGst;
            if (clientGst      && base.gstNumber && base.gstNumber !== clientGst) patch.gstNumber = clientGst;
            if (billingAddress && !base.address)   patch.address   = billingAddress;
            if (billingAddress && base.address && base.address !== billingAddress) patch.address = billingAddress;
            return patch;
          };

          // 1. If the invoice already carries a linked customerId, use it
          //    directly — same as the previous GST/address sync.
          let resolvedCustomerId = dataToSave.customerId || null;

          if (resolvedCustomerId) {
            // ── Known customer — update changed fields ──────────────────
            const existing = await getCustomer(resolvedCustomerId);
            if (existing) {
              const patch = _buildPatch(existing);
              if (Object.keys(patch).length > 0) {
                console.log('[CUSTOMER-AUTO-SAVE] updated', {
                  customerId: resolvedCustomerId,
                  patch,
                });
                await updateCustomer(resolvedCustomerId, { ...existing, ...patch });
              } else {
                console.log('[CUSTOMER-AUTO-SAVE] skipped (no changed fields)', {
                  customerId: resolvedCustomerId,
                });
              }
            }
          } else {
            // ── No linked customer — search by email → phone → name ─────
            const allCustomers = await getAllCustomers();
            let found = null;

            if (clientEmail) {
              found = allCustomers.find(
                (c) => c.email && c.email.toLowerCase() === clientEmail.toLowerCase()
              ) ?? null;
            }
            if (!found && clientPhone) {
              found = allCustomers.find(
                (c) => c.phone && c.phone === clientPhone
              ) ?? null;
            }
            if (!found && clientName) {
              found = allCustomers.find(
                (c) => c.name && c.name.toLowerCase() === clientName.toLowerCase()
              ) ?? null;
            }

            if (found) {
              // ── Existing customer found — patch missing/changed fields ─
              resolvedCustomerId = found.id;
              const patch = _buildPatch(found);
              if (Object.keys(patch).length > 0) {
                console.log('[CUSTOMER-AUTO-SAVE] updated', {
                  customerId: resolvedCustomerId,
                  patch,
                });
                await updateCustomer(resolvedCustomerId, { ...found, ...patch });
              } else {
                console.log('[CUSTOMER-AUTO-SAVE] skipped (no changed fields)', {
                  customerId: resolvedCustomerId,
                });
              }
            } else {
              // ── No match — create a new customer record ─────────────────
              const newCustomerData = { name: clientName };
              if (clientEmail)    newCustomerData.email      = clientEmail;
              if (clientPhone)    newCustomerData.phone      = clientPhone;
              if (clientGst)      newCustomerData.gstNumber  = clientGst;
              if (billingAddress) newCustomerData.address    = billingAddress;

              try {
                const created = await addCustomer(newCustomerData);
                resolvedCustomerId = created.id;
                console.log('[CUSTOMER-AUTO-SAVE] created', {
                  customerId: resolvedCustomerId,
                  name: clientName,
                  email: clientEmail,
                  phone: clientPhone,
                  gstNumber: clientGst,
                  address: billingAddress,
                });
              } catch (createErr) {
                // createCustomer throws if a duplicate slipped through the
                // in-memory check (e.g. concurrent saves).  Log and move on.
                console.warn('[CUSTOMER-AUTO-SAVE] create failed (duplicate?)', createErr?.message || String(createErr));
              }
            }

            // ── Link the resolved customer back to the saved invoice ─────
            // The invoice has already been written; patch just the customerId
            // so future edits find the link.
            if (resolvedCustomerId != null) {
              const invoiceId = savedInvoice?.id ?? (isEditing ? normalizeId(id) : null);
              if (invoiceId != null) {
                try {
                  await updateInvoice(invoiceId, { ...dataToSave, customerId: resolvedCustomerId });
                  // Mirror the link into local React state so subsequent
                  // saves in the same session don't re-enter the create path.
                  setInvoice((prev) => prev ? { ...prev, customerId: resolvedCustomerId } : prev);
                } catch (linkErr) {
                  console.warn('[CUSTOMER-AUTO-SAVE] Failed to link customerId to invoice:', linkErr?.message || String(linkErr));
                }
              }
            }
          }
        } else {
          console.log('[CUSTOMER-AUTO-SAVE] skipped (no clientName)');
        }
      } catch (custErr) {
        // Non-fatal — the invoice has already been saved successfully.
        console.warn('[CUSTOMER-AUTO-SAVE] Unexpected error during customer sync:', custErr?.message || String(custErr));
      }

      // Detect invoice line items that don't exist in the products catalogue.
      // Only custom items (no productId) with a non-empty name are candidates.
      let dialogOpened = false;
      const customItems = dataToSave.items.filter(item =>
        !item.productId && item.name && item.name.trim());
      if (customItems.length > 0) {
        const existingProductNames = new Set(products.map(p => p.name.toLowerCase()));
        const newCustomItems = customItems
          .map(item => ({ ...item, currency: dataToSave.currency }))
          .filter(item => !existingProductNames.has(item.name.toLowerCase()));

        if (newCustomItems.length > 0) {
          console.log('[SAVE] Detected new custom items not in products', {
            count: newCustomItems.length,
            names: newCustomItems.map(i => i.name),
          });
          setPendingCustomItems(newCustomItems);
          setCustomItemsDialogOpen(true);
          dialogOpened = true;
        }
      }

      return { savedInvoice, dialogOpened };
    } catch (e) {
      console.error('[INVOICE-SAVE] Failed to save:', e);
      toast.error('Failed to save invoice');
      return undefined;
    } finally {
      setSaving(false);
      _saveInFlightRef.current = false;
    }
  }, [invoice, isEditing, id, update, add, navigate, products, addCustomer, updateCustomer]);

  const handlePreview = useCallback(async () => {
    const validation = validateInvoiceItems(invoice);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }
    const saveResult = await handleSave();
    // handleSave returns undefined when the in-flight guard fires (duplicate
    // call) or when save fails — both should be treated as no-op.
    if (!saveResult) return;

    const { savedInvoice, dialogOpened } = saveResult;
    const targetId = savedInvoice?.id ?? (isEditing ? id : undefined);

    console.log('[PREVIEW LOAD ID]', { targetId, savedId: savedInvoice?.id, routeId: id, isEditing, dialogOpened });

    if (targetId == null) return; // save failed; handleSave already toasted

    const invoiceForState = savedInvoice ?? (isEditing ? { ...invoice, id: normalizeId(id) } : null);
    const destination = {
      path: `/invoices/${targetId}/preview`,
      state: invoiceForState ? { invoice: invoiceForState } : undefined,
    };

    if (dialogOpened) {
      // The "Save custom items as products" dialog is now open.  We must NOT
      // navigate yet — that would unmount the component and destroy the dialog
      // before the user has a chance to interact with it.  Store the
      // destination and fire it from the dialog's onOpenChange callback.
      _pendingPreviewNavRef.current = destination;
    } else {
      navigate(destination.path, { state: destination.state });
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
            onClick={() => navigate('/invoices')}
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
        onOpenChange={(open) => {
          setCustomItemsDialogOpen(open);
          // When the dialog closes (user saved products or skipped), check
          // whether a Preview navigation was deferred.  If so, fire it now
          // that the dialog is no longer blocking.
          if (!open && _pendingPreviewNavRef.current) {
            const { path, state } = _pendingPreviewNavRef.current;
            _pendingPreviewNavRef.current = null;
            navigate(path, { state });
          }
        }}
        customItems={pendingCustomItems}
        onSave={handleSaveCustomItemsAsProducts}
      />
    </motion.div>
  );
}
