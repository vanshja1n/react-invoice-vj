import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StickyNote } from 'lucide-react';

export function InvoiceFooter({ data, onChange }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-muted-foreground" />
          Notes & Terms
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs">Notes</Label>
          <Textarea
            id="notes"
            value={data.notes || ''}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Any notes for the client..."
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="terms" className="text-xs">Terms & Conditions</Label>
          <Textarea
            id="terms"
            value={data.terms || ''}
            onChange={(e) => onChange({ terms: e.target.value })}
            placeholder="Payment terms, late fees, etc."
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
}
