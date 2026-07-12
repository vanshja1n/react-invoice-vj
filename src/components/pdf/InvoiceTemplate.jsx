import { TEMPLATE_IDS } from '@/types/template';
import { resolveTemplateId, prepareInvoiceForRender } from '@/services/templateService';
import { ModernTemplate } from '@/components/pdf/templates/ModernTemplate';
import { ClassicTemplate } from '@/components/pdf/templates/ClassicTemplate';
import { MinimalTemplate } from '@/components/pdf/templates/MinimalTemplate';
import { CorporateTemplate } from '@/components/pdf/templates/CorporateTemplate';

const TEMPLATE_COMPONENTS = {
  [TEMPLATE_IDS.CORPORATE]: CorporateTemplate,
  [TEMPLATE_IDS.MODERN]: ModernTemplate,
  [TEMPLATE_IDS.CLASSIC]: ClassicTemplate,
  [TEMPLATE_IDS.MINIMAL]: MinimalTemplate,
};

/**
 * Central invoice template renderer.
 * All preview, PDF, print, and ZIP export flows use this component.
 */
export function InvoiceTemplateRenderer({ invoice }) {
  if (!invoice) return null;

  const prepared = prepareInvoiceForRender(invoice);
  const templateId = resolveTemplateId(invoice);
  const TemplateComponent = TEMPLATE_COMPONENTS[templateId] || CorporateTemplate;

  return <TemplateComponent invoice={prepared} />;
}

/** @deprecated Use InvoiceTemplateRenderer — kept for backward compatibility */
export function InvoiceTemplate({ invoice }) {
  return <InvoiceTemplateRenderer invoice={invoice} />;
}
