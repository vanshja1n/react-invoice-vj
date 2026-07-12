import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Building2,
  Palette,
  FileText,
  ImagePlus,
  X,
  Save,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { CURRENCIES } from '@/types/invoice';

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateField('companyLogo', ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    updateField('companyLogo', null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = () => {
    setSaving(true);
    try {
      updateSettings(form);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (t) => {
    setTheme(t);
    updateField('theme', t);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <PageHeader
        title="Settings"
        description="Configure your default invoice settings"
      >
        <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </PageHeader>

      <div className="space-y-6">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Company Information
            </CardTitle>
            <CardDescription className="text-xs">
              These details will auto-fill in new invoices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo */}
            <div>
              <Label className="text-xs mb-2 block">Company Logo</Label>
              {form.companyLogo ? (
                <div className="relative inline-block">
                  <img
                    src={form.companyLogo}
                    alt="Company logo"
                    className="h-16 w-auto object-contain rounded-lg border border-border p-1"
                  />
                  <button
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
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
                  <ImagePlus className="h-3.5 w-3.5" /> Upload Logo
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
                <Label htmlFor="s-companyName" className="text-xs">Company Name</Label>
                <Input
                  id="s-companyName"
                  value={form.companyName || ''}
                  onChange={(e) => updateField('companyName', e.target.value)}
                  placeholder="Your Company"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-companyEmail" className="text-xs">Email</Label>
                <Input
                  id="s-companyEmail"
                  type="email"
                  value={form.companyEmail || ''}
                  onChange={(e) => updateField('companyEmail', e.target.value)}
                  placeholder="company@email.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-companyPhone" className="text-xs">Phone</Label>
                <Input
                  id="s-companyPhone"
                  value={form.companyPhone || ''}
                  onChange={(e) => updateField('companyPhone', e.target.value)}
                  placeholder="+91 12345 67890"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-companyAddress" className="text-xs">Address</Label>
                <Input
                  id="s-companyAddress"
                  value={form.companyAddress || ''}
                  onChange={(e) => updateField('companyAddress', e.target.value)}
                  placeholder="123 Business Street"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-gstNumber" className="text-xs">GST/VAT Number</Label>
                <Input
                  id="s-gstNumber"
                  value={form.gstNumber || ''}
                  onChange={(e) => updateField('gstNumber', e.target.value)}
                  placeholder="e.g. 29ABCDE1234F1Z5"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Invoice Defaults
            </CardTitle>
            <CardDescription className="text-xs">
              Default values for new invoices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="s-defaultTax" className="text-xs">Default Tax Rate (%)</Label>
                <Input
                  id="s-defaultTax"
                  type="number"
                  value={form.defaultTax || ''}
                  onChange={(e) => updateField('defaultTax', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-defaultCurrency" className="text-xs">Default Currency</Label>
                <Select
                  value={form.defaultCurrency || '₹'}
                  onValueChange={(v) => updateField('defaultCurrency', v)}
                >
                  <SelectTrigger id="s-defaultCurrency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.value} — {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-defaultNotes" className="text-xs">Default Notes</Label>
              <Textarea
                id="s-defaultNotes"
                value={form.defaultNotes || ''}
                onChange={(e) => updateField('defaultNotes', e.target.value)}
                placeholder="Thank you for your business!"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-defaultTerms" className="text-xs">Default Terms & Conditions</Label>
              <Textarea
                id="s-defaultTerms"
                value={form.defaultTerms || ''}
                onChange={(e) => updateField('defaultTerms', e.target.value)}
                placeholder="Payment is due within 30 days..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label className="text-xs">Theme</Label>
              <div className="grid grid-cols-3 gap-3">
                {['light', 'dark', 'system'].map((t) => (
                  <button
                    key={t}
                    onClick={() => handleThemeChange(t)}
                    className={`rounded-lg border-2 px-4 py-3 text-sm font-medium capitalize transition-colors ${
                      (form.theme || theme) === t
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
