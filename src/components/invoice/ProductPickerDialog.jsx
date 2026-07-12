import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, Plus } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { formatCurrency } from '@/types/invoice';
import { getUnitShort } from '@/types/product';
import { StockBadge } from '@/components/shared/StockBadge';
import { EmptyState } from '@/components/shared/EmptyState';

export function ProductPickerDialog({ open, onOpenChange, onSelect, currency }) {
  const { products, search } = useProducts();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) {
      setQuery('');
      search('');
    }
  }, [open, search]);

  const handleSearch = (e) => {
    const val = e.target.value;
    setQuery(val);
    search(val);
  };

  const handleSelect = (product) => {
    onSelect(product);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-border">
          <DialogTitle>Add Product</DialogTitle>
        </DialogHeader>
        
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={handleSearch}
              placeholder="Search by name or SKU..."
              className="pl-9 h-10"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {products.length === 0 ? (
            <div className="py-8">
              <EmptyState
                icon={Package}
                title="No products found"
                description={query ? "Try a different search term" : "Add some products to your inventory first"}
              />
            </div>
          ) : (
            <div className="space-y-1">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border"
                  onClick={() => handleSelect(product)}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{product.name}</span>
                      {product.sku && (
                        <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded font-mono">
                          {product.sku}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <StockBadge product={product} />
                      <span className="text-xs text-muted-foreground">
                        Unit: {getUnitShort(product.unit)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-semibold text-sm">
                      {formatCurrency(product.sellingPrice, currency)}
                    </span>
                    <Button variant="secondary" size="sm" className="h-8 gap-1 rounded-full">
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
