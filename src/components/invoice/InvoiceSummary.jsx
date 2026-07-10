import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calculator } from 'lucide-react';
import { CURRENCIES, formatCurrency } from '@/types/invoice';

export function InvoiceSummary({ data, onChange }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Currency selector */}
        <div className="space-y-1.5">
          <Label className="text-xs">Currency</Label>
          <Select
            value={data.currency || '₹'}
            onValueChange={(v) => onChange({ currency: v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.value} — {c.label} ({c.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tax & Discount */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="taxRate" className="text-xs">Tax (%)</Label>
            <Input
              id="taxRate"
              type="number"
              value={data.taxRate || ''}
              onChange={(e) => onChange({ taxRate: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              min="0"
              max="100"
              step="0.01"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discountRate" className="text-xs">Discount (%)</Label>
            <Input
              id="discountRate"
              type="number"
              value={data.discountRate || ''}
              onChange={(e) => onChange({ discountRate: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              min="0"
              max="100"
              step="0.01"
              className="h-9"
            />
          </div>
        </div>

        {/* Shipping */}
        <div className="space-y-1.5">
          <Label htmlFor="shippingCharges" className="text-xs">Shipping Charges</Label>
          <Input
            id="shippingCharges"
            type="number"
            value={data.shippingCharges || ''}
            onChange={(e) => onChange({ shippingCharges: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="h-9"
          />
        </div>

        <Separator />

        {/* Totals */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(data.subTotal, data.currency)}</span>
          </div>
          {data.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Discount ({data.discountRate}%)</span>
              <span>-{formatCurrency(data.discountAmount, data.currency)}</span>
            </div>
          )}
          {data.taxAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({data.taxRate}%)</span>
              <span className="font-medium">+{formatCurrency(data.taxAmount, data.currency)}</span>
            </div>
          )}
          {parseFloat(data.shippingCharges || 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-medium">+{formatCurrency(data.shippingCharges, data.currency)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(data.total, data.currency)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
