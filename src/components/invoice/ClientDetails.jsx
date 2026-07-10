import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { User, MapPin } from 'lucide-react';
import { useState } from 'react';

export function ClientDetails({ data, onChange }) {
  const [showShipping, setShowShipping] = useState(!!data.shippingAddress);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          Client Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="clientName" className="text-xs">Client Name</Label>
            <Input
              id="clientName"
              value={data.clientName || ''}
              onChange={(e) => onChange({ clientName: e.target.value })}
              placeholder="Client or company name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientEmail" className="text-xs">Email</Label>
            <Input
              id="clientEmail"
              type="email"
              value={data.clientEmail || ''}
              onChange={(e) => onChange({ clientEmail: e.target.value })}
              placeholder="client@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientPhone" className="text-xs">Phone</Label>
            <Input
              id="clientPhone"
              value={data.clientPhone || ''}
              onChange={(e) => onChange({ clientPhone: e.target.value })}
              placeholder="+91 12345 67890"
            />
          </div>
        </div>

        {/* Billing Address */}
        <div className="space-y-1.5">
          <Label htmlFor="billingAddress" className="text-xs flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Billing Address
          </Label>
          <Textarea
            id="billingAddress"
            value={data.billingAddress || ''}
            onChange={(e) => onChange({ billingAddress: e.target.value })}
            placeholder="Street, City, State, ZIP"
            rows={2}
          />
        </div>

        {/* Shipping Address Toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="showShipping"
            checked={showShipping}
            onCheckedChange={(checked) => {
              setShowShipping(checked);
              if (!checked) onChange({ shippingAddress: '' });
            }}
          />
          <Label htmlFor="showShipping" className="text-xs cursor-pointer">
            Different shipping address
          </Label>
        </div>

        {showShipping && (
          <div className="space-y-1.5">
            <Label htmlFor="shippingAddress" className="text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Shipping Address
            </Label>
            <Textarea
              id="shippingAddress"
              value={data.shippingAddress || ''}
              onChange={(e) => onChange({ shippingAddress: e.target.value })}
              placeholder="Shipping street, City, State, ZIP"
              rows={2}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
