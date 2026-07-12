import { useState, useMemo } from 'react';
import { Check, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Card } from '@/components/ui/card';
import {
  TEMPLATE_LIST,
  TEMPLATE_CONFIG,
  TEMPLATE_IDS,
} from '@/services/templateService';
import { CorporateTemplate } from '@/components/pdf/templates/CorporateTemplate';
import { ModernTemplate } from '@/components/pdf/templates/ModernTemplate';
import { MinimalTemplate } from '@/components/pdf/templates/MinimalTemplate';
import { ClassicTemplate } from '@/components/pdf/templates/ClassicTemplate';
import { createDefaultInvoice } from '@/types/invoice';
import { getSettings } from '@/services/settings';

const TEMPLATE_COMPONENTS = {
  [TEMPLATE_IDS.CORPORATE]: CorporateTemplate,
  [TEMPLATE_IDS.MODERN]: ModernTemplate,
  [TEMPLATE_IDS.MINIMAL]: MinimalTemplate,
  [TEMPLATE_IDS.CLASSIC]: ClassicTemplate,
};

export function TemplateSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);

  const sampleInvoice = useMemo(() => {
    const settings = getSettings();
    const defaultInvoice = createDefaultInvoice(settings);
    defaultInvoice.invoiceNumber = 'INV-2024-001';
    defaultInvoice.items = [
      {
        id: 1,
        description: 'Web Development Services',
        quantity: 1,
        rate: 1500,
        total: 1500,
      },
    ];
    return defaultInvoice;
  }, []);

  const selectedConfig = TEMPLATE_CONFIG[value] || TEMPLATE_CONFIG[TEMPLATE_IDS.CORPORATE];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 w-[160px] justify-between"
        >
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span>Template</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">{selectedConfig.label}</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-3" align="end">
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATE_LIST.map((template) => {
            const TemplateComponent = TEMPLATE_COMPONENTS[template.id];
            const isSelected = value === template.id;

            return (
              <button
                key={template.id}
                onClick={() => {
                  onChange(template.id);
                  setOpen(false);
                }}
                className="text-left group"
              >
                <Card
                  className={`
                    relative p-2 rounded-xl transition-all duration-150 hover:shadow-md
                    ${isSelected ? 'ring-2 ring-primary bg-primary/5 border-primary' : 'border-border hover:border-muted-foreground/30'}
                  `}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 z-10">
                      <div className="bg-primary text-primary-foreground rounded-full p-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                    </div>
                  )}

                  <div className="relative overflow-hidden rounded-lg border bg-white dark:bg-gray-900">
                    <div
                      style={{
                        transform: 'scale(0.25)',
                        transformOrigin: 'top left',
                        width: '400%',
                        height: 'auto',
                      }}
                    >
                      <TemplateComponent invoice={{ ...sampleInvoice, template: template.id }} />
                    </div>
                  </div>

                  <div className="mt-2 px-1">
                    <p className="font-medium text-sm">{template.label}</p>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
