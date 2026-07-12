// Product unit options
export const PRODUCT_UNITS = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'g', label: 'Grams' },
  { value: 'box', label: 'Boxes' },
  { value: 'ltr', label: 'Litres' },
  { value: 'm', label: 'Metres' },
  { value: 'ft', label: 'Feet' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'set', label: 'Sets' },
  { value: 'pair', label: 'Pairs' },
  { value: 'hr', label: 'Hours' },
  { value: 'unit', label: 'Units' },
];

// Category presets
export const PRODUCT_CATEGORIES = [
  'General',
  'Electronics',
  'Clothing',
  'Food & Beverage',
  'Services',
  'Raw Materials',
  'Stationery',
  'Hardware',
  'Software',
  'Other',
];

// Default product factory
export const createDefaultProduct = () => ({
  name: '',
  sku: '',
  category: 'General',
  sellingPrice: 0,
  costPrice: 0,
  currentStock: 0,
  lowStockAlert: 5,
  unit: 'pcs',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Generate SKU
export function generateSKU(lastNumber = 0) {
  const next = lastNumber + 1;
  return `PRD-${String(next).padStart(4, '0')}`;
}

// Get unit label
export function getUnitLabel(unitValue) {
  const unit = PRODUCT_UNITS.find((u) => u.value === unitValue);
  return unit ? unit.label : unitValue;
}

// Get short unit label (for display)
export function getUnitShort(unitValue) {
  return unitValue || 'pcs';
}

// Check if product is low stock
export function isLowStock(product) {
  return product.currentStock <= product.lowStockAlert;
}

// Check if product is out of stock
export function isOutOfStock(product) {
  return product.currentStock <= 0;
}
