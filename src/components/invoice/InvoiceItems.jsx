import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Copy, GripVertical, Package, PackagePlus } from 'lucide-react';
import { generateId, normalizeInvoiceItemValue } from '@/types/invoice';
import { PRODUCT_UNITS } from '@/types/product';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ProductPickerDialog } from './ProductPickerDialog';

function SortableItem({ item, currency, onEdit, onDelete, onDuplicate }) {
  console.log('[InvoiceItems][RENDER]', { id: item.id, quantity: item.quantity, typeofQuantity: typeof item.quantity, displayValue: String(item.quantity) });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const lineTotal = (parseFloat(item.price || 0) * parseInt(item.quantity || 0, 10)).toFixed(2);

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div className="flex items-start gap-2 p-3 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-2.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Fields */}
        <div className="flex-1 grid grid-cols-12 gap-2 items-start">
          {/* Name & Description */}
          <div className="col-span-12 sm:col-span-5 space-y-1.5 relative">
            {item.productId && (
              <div className="absolute -top-2 -right-2 bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded font-medium">
                Linked
              </div>
            )}
            <Input
              value={item.name}
              onChange={(e) => onEdit(item.id, 'name', e.target.value)}
              placeholder="Item name"
              className="h-8 text-sm"
            />
            <Input
              value={item.description}
              onChange={(e) => onEdit(item.id, 'description', e.target.value)}
              placeholder="Description (optional) / SKU"
              className="h-8 text-xs text-muted-foreground"
            />
          </div>

          {/* Qty & Unit */}
          <div className="col-span-4 sm:col-span-2">
            <div className="flex items-center gap-1">
<Input
  type="text"
  inputMode="numeric"
  value={item.quantity === '' ? '' : String(item.quantity)}
  onChange={(e) => onEdit(item.id, 'quantity', e.target.value)}
  className="h-8 text-sm text-center w-full"
  placeholder="Qty"
/>
              <Select
                value={item.unit}
                onValueChange={(v) => onEdit(item.id, 'unit', v)}
              >
                <SelectTrigger className="h-8 text-xs w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_UNITS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Price */}
          <div className="col-span-4 sm:col-span-2">
            <Input
              type="number"
              value={item.price === '' ? '' : String(item.price)}
              onChange={(e) => onEdit(item.id, 'price', e.target.value)}
              min="0"
              step="0.01"
              className="h-8 text-sm text-right"
              placeholder="Price"
            />
          </div>

          {/* Amount */}
          <div className="col-span-4 sm:col-span-3 flex items-center justify-end gap-1">
            <span className="text-sm font-medium whitespace-nowrap mt-1">
              {currency}{lineTotal}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-0.5 mt-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onDuplicate(item.id)}
            aria-label="Duplicate row"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(item.id)}
            aria-label="Delete row"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function InvoiceItems({ items, currency, onChange }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleEdit = (id, field, value) => {
    console.log('[InvoiceItems][EDIT]', { id, field, value });
    const processedValue = normalizeInvoiceItemValue(field, value);
    console.log('[InvoiceItems][PROCESSED]', { id, field, processedValue, typeofProcessed: typeof processedValue });
    
    const updated = items.map((item) =>
      item.id === id ? { ...item, [field]: processedValue } : item
    );
    onChange(updated);
  };

  const handleAddCustom = () => {
    const newItem = {
      id: generateId(),
      name: '',
      description: '',
      quantity: 1,
      price: 0,
      tax: 0,
      productId: null,
      unit: 'pcs',
    };
    onChange([...items, newItem]);
  };

  const handleAddProduct = (product) => {
    const newItem = {
      id: generateId(),
      name: product.name,
      description: product.sku ? `SKU: ${product.sku}` : '',
      quantity: 1,
      price: product.sellingPrice || 0,
      tax: 0,
      productId: product.id,
      unit: product.unit || 'pcs',
    };
    onChange([...items, newItem]);
  };

  const handleDelete = (id) => {
    const updatedItems = items.filter((item) => item.id !== id);
    // If all items are deleted, leave a new default item is added in createDefaultInvoice, but we can let the user delete all if needed
    onChange(updatedItems);
  };

  const handleDuplicate = (id) => {
    const original = items.find((item) => item.id === id);
    if (!original) return;
    const duplicate = { ...original, id: generateId() };
    const index = items.findIndex((item) => item.id === id);
    const updated = [...items];
    updated.splice(index + 1, 0, duplicate);
    onChange(updated);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    onChange(arrayMove(items, oldIndex, newIndex));
  };

  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Line Items
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleAddCustom}>
                <Plus className="h-3.5 w-3.5" /> Custom Item
              </Button>
              <Button type="button" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setPickerOpen(true)}>
                <PackagePlus className="h-3.5 w-3.5" /> Add Product
              </Button>
            </div>
          </div>
          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-12 gap-2 px-10 text-xs font-medium text-muted-foreground pt-2">
            <div className="col-span-5">Item</div>
            <div className="col-span-2 text-center">Qty / Unit</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-3 text-right pr-12">Amount</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              {items.map((item, index) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  index={index}
                  currency={currency}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleAddProduct}
        currency={currency}
      />
    </>
  );
}
