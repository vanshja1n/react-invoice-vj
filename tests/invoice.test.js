import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInvoiceItemValue, parseInvoiceQuantity, calculateInvoiceTotals } from '../src/types/invoice.js';

test('quantity updates stay controlled and still calculate totals correctly', () => {
  assert.equal(normalizeInvoiceItemValue('quantity', '2'), '2');
  assert.equal(normalizeInvoiceItemValue('quantity', ''), '');
  assert.equal(parseInvoiceQuantity('10'), 10);
  assert.equal(parseInvoiceQuantity(''), 0);

  const totals = calculateInvoiceTotals([{ price: 20, quantity: '3' }], 0, 0, 0);
  assert.equal(totals.subTotal, 60);
  assert.equal(totals.total, 60);
});
