import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const createDefaultCustomer = () => ({
  name: '',
  phone: '',
  email: '',
  address: '',
  gstNumber: '',
});

export function CustomerFormDialog({ open, onOpenChange, customer, onSave }) {
  const [formData, setFormData] = useState(createDefaultCustomer());
  const [saving, setSaving] = useState(false);
  const isEditing = !!customer;

  useEffect(() => {
    if (open) {
      if (customer) {
        setFormData({ ...customer });
      } else {
        setFormData(createDefaultCustomer());
      }
    }
  }, [open, customer]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Customer name is required');
      return;
    }
    
    setSaving(true);
    try {
      await onSave(formData);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Customer/Company Name *</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Acme Corp"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="contact@acmecorp.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gstNumber">GST/VAT Number</Label>
            <Input
              id="gstNumber"
              value={formData.gstNumber || ''}
              onChange={(e) => handleChange('gstNumber', e.target.value)}
              placeholder="e.g. 29ABCDE1234F1Z5"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Billing Address</Label>
            <Textarea
              id="address"
              value={formData.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Full address"
              rows={3}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
