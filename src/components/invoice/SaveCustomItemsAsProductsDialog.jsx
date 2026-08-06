import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useState } from 'react';

export function SaveCustomItemsAsProductsDialog({
  open,
  onOpenChange,
  customItems,
  onSave,
}) {
  const [selectedItems, setSelectedItems] = useState(() =>
    customItems.reduce((acc, item) => {
      acc[item.id] = true;
      return acc;
    }, {})
  );
  const [saving, setSaving] = useState(false);

  const handleToggle = (itemId) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleSave = async () => {
    const itemsToSave = customItems.filter(item => selectedItems[item.id]);
    // Await onSave so every addProduct() call completes and its products:create
    // queue entry is written to localStorage BEFORE onOpenChange(false) fires.
    // Without the await, the dialog closes synchronously and the parent's
    // onOpenChange handler immediately triggers navigation — unmounting the
    // InvoiceEditorPage while addProduct() is still running, which means the
    // queue entry may not exist yet when the sync engine's next tick runs.
    setSaving(true);
    try {
      await onSave(itemsToSave);
    } finally {
      setSaving(false);
    }
    onOpenChange(false);
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Save Custom Items as Products?</AlertDialogTitle>
          <AlertDialogDescription>
            The following items were added as custom items and don't exist in your products yet.
            Select which ones you'd like to save as products:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {customItems.map(item => (
            <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-card">
              <Checkbox
                id={`item-${item.id}`}
                checked={selectedItems[item.id]}
                onCheckedChange={() => handleToggle(item.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.description || 'No description'} • {item.currency}{item.price}
                </p>
              </div>
            </div>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleSkip} disabled={saving}>
            Keep Invoice Only
          </AlertDialogCancel>
          <Button onClick={handleSave} disabled={saving || !Object.values(selectedItems).some(v => v)}>
            {saving ? 'Saving…' : 'Save as Products'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
