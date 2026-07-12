import { isLowStock, isOutOfStock } from '@/types/product';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

export function StockBadge({ product }) {
  if (!product) return null;

  if (isOutOfStock(product)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
        <AlertCircle className="h-3.5 w-3.5" />
        Out of Stock
      </span>
    );
  }

  if (isLowStock(product)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        Low Stock
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
      <CheckCircle2 className="h-3.5 w-3.5" />
      In Stock
    </span>
  );
}
