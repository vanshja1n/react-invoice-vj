import { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImagePlus, X, Building2 } from 'lucide-react';

export function InvoiceHeader({ data, onChange }) {
  const fileInputRef = useRef(null);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange({ companyLogo: ev.target.result });
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    onChange({ companyLogo: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Company Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logo */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-2 block">
            Company Logo
          </Label>
          {data.companyLogo ? (
            <div className="relative inline-block">
              <img
                src={data.companyLogo}
                alt="Company logo"
                className="h-16 w-auto object-contain rounded-lg border border-border p-1"
              />
              <button
                onClick={removeLogo}
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90"
                aria-label="Remove logo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Upload Logo
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="companyName" className="text-xs">Company Name</Label>
            <Input
              id="companyName"
              value={data.companyName || ''}
              onChange={(e) => onChange({ companyName: e.target.value })}
              placeholder="Your Company"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="companyEmail" className="text-xs">Email</Label>
            <Input
              id="companyEmail"
              type="email"
              value={data.companyEmail || ''}
              onChange={(e) => onChange({ companyEmail: e.target.value })}
              placeholder="company@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="companyPhone" className="text-xs">Phone</Label>
            <Input
              id="companyPhone"
              value={data.companyPhone || ''}
              onChange={(e) => onChange({ companyPhone: e.target.value })}
              placeholder="+91 12345 67890"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="companyAddress" className="text-xs">Address</Label>
            <Input
              id="companyAddress"
              value={data.companyAddress || ''}
              onChange={(e) => onChange({ companyAddress: e.target.value })}
              placeholder="123 Business Street"
            />
          </div>
        </div>

        {/* Invoice Meta */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border">
          <div className="space-y-1.5">
            <Label htmlFor="invoiceNumber" className="text-xs">Invoice Number</Label>
            <Input
              id="invoiceNumber"
              value={data.invoiceNumber || ''}
              onChange={(e) => onChange({ invoiceNumber: e.target.value })}
              placeholder="INV-0001"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="issueDate" className="text-xs">Issue Date</Label>
            <Input
              id="issueDate"
              type="date"
              value={data.issueDate || ''}
              onChange={(e) => onChange({ issueDate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate" className="text-xs">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={data.dueDate || ''}
              onChange={(e) => onChange({ dueDate: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
