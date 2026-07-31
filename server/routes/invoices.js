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

router.post('/', async (req, res) => {
  try {
    const validated = createInvoiceSchema.parse(req.body);
    const now = new Date().toISOString();

    const invoice = new Invoice({
      ...validated,
      userId: req.user.id,
      createdAt: validated.createdAt || now,
      updatedAt: now,
    });
    await invoice.save();

    res.status(201).json(invoice.toObject());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Create invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    const now = new Date().toISOString();

    const docs = items.map((item) => ({
      ...item,
      userId: req.user.id,
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || now,
    }));

    if (docs.length > 0) {
      await Invoice.insertMany(docs, { ordered: false });
    }

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
