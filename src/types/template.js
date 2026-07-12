export const TEMPLATE_IDS = {
  MODERN: 'modern',
  CLASSIC: 'classic',
  MINIMAL: 'minimal',
  CORPORATE: 'corporate',
};

export const TEMPLATE_CONFIG = {
  [TEMPLATE_IDS.CORPORATE]: {
    id: TEMPLATE_IDS.CORPORATE,
    label: 'Corporate',
    description: 'Professional business layout',
  },
  [TEMPLATE_IDS.MODERN]: {
    id: TEMPLATE_IDS.MODERN,
    label: 'Modern',
    description: 'Bold contemporary design',
  },
  [TEMPLATE_IDS.MINIMAL]: {
    id: TEMPLATE_IDS.MINIMAL,
    label: 'Minimal',
    description: 'Clean minimal layout',
  },
  [TEMPLATE_IDS.CLASSIC]: {
    id: TEMPLATE_IDS.CLASSIC,
    label: 'Classic',
    description: 'Traditional invoice style',
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATE_CONFIG);

export const DEFAULT_TEMPLATE = TEMPLATE_IDS.CORPORATE;
