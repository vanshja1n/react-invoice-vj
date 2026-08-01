import Router from 'express';
import { z } from 'zod';
import Invoice from '../models/Invoice.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const baseInvoiceSchema = z.object({
  invoiceNumber: z.string().optional(),
  status: z.string().optional(),
  clientName: z.string().optional(),
  clientEmail: z.string().optional(),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  companyName: z.string().optional(),
  companyAddress: z.string().optional(),
  companyEmail: z.string().optional(),
  companyPhone: z.string().optional(),
  companyLogo: z.string().optional().nullable(),
  gstNumber: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  items: z.array(z.any()).optional(),
  subtotal: z.number().optional(),
  taxAmount: z.number().optional(),
  discountAmount: z.number().optional(),
  total: z.number().optional(),
  amount: z.number().optional(),
  customerId: z.any().optional(),
  currency: z.string().optional(),
  template: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  paidAt: z.string().optional().nullable(),
  signature: z.string().optional().nullable(),
});

const createInvoiceSchema = baseInvoiceSchema;
const updateInvoiceSchema = baseInvoiceSchema.partial();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const invoices = await Invoice.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(invoices);
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).lean();

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (err) {
    console.error('Get invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const BACKEND_CREATE_LOG = true;
function _logCreate(payload) {
  if (!BACKEND_CREATE_LOG) return;
  try { console.info('[BACKEND-CREATE]', payload); } catch { void 0; }
}
function _reqId(req, fallbackPrefix = 'inv') {
  const h = req?.headers?.['x-request-id'];
  if (h && String(h).trim()) return String(h).trim();
  return `${fallbackPrefix}_srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

router.post('/', async (req, res) => {
  const requestId = _reqId(req, 'inv');
  const endpoint = 'POST /api/invoices';
  try {
    const validated = createInvoiceSchema.parse(req.body);
    const now = new Date().toISOString();
    const userId = req.user.id;

    if (validated.invoiceNumber && String(validated.invoiceNumber).trim()) {
      const hit = await Invoice.findOne({ userId, invoiceNumber: validated.invoiceNumber }).lean();
      if (hit) {
        _logCreate({ timestamp: new Date().toISOString(), endpoint, requestId, entityId: String(hit._id ?? ''), invoiceNumber: hit.invoiceNumber, deduped: true });
        return res.status(200).json(hit);
      }
    }

    const invoice = new Invoice({
      ...validated,
      userId,
      createdAt: validated.createdAt || now,
      updatedAt: now,
    });
    await invoice.save();
    const saved = invoice.toObject();
    _logCreate({ timestamp: new Date().toISOString(), endpoint, requestId, entityId: String(saved._id ?? ''), invoiceNumber: saved.invoiceNumber, deduped: false });
    res.status(201).json(saved);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Create invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/batch', async (req, res) => {
  const requestId = _reqId(req, 'inv_batch');
  const endpoint = 'POST /api/invoices/batch';
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    const now = new Date().toISOString();
    const userId = req.user.id;

    const docs = items.map((item) => ({
      ...item,
      userId,
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || now,
    }));

    if (docs.length > 0) {
      await Invoice.insertMany(docs, { ordered: false });
    }

    _logCreate({ timestamp: new Date().toISOString(), endpoint, requestId, entityId: null, created: docs.length, batch: true });
    res.status(201).json({ created: docs.length });
  } catch (err) {
    console.error('Batch create invoices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const validated = updateInvoiceSchema.parse(req.body);
    const now = new Date().toISOString();

    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { ...validated, updatedAt: now },
      { new: true, runValidators: true }
    );

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice.toObject());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Update invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await Invoice.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!result) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    console.error('Delete invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/', async (req, res) => {
  try {
    await Invoice.deleteMany({ userId: req.user.id });
    res.json({ message: 'All invoices deleted' });
  } catch (err) {
    console.error('Delete all invoices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
