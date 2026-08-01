import Router from 'express';
import { z } from 'zod';
import Customer from '../models/Customer.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const baseCustomerSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const createCustomerSchema = baseCustomerSchema.refine(
  (data) => data.name && data.name.trim().length > 0,
  { message: 'Name is required', path: ['name'] }
);
const updateCustomerSchema = baseCustomerSchema.partial();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(customers);
  } catch (err) {
    console.error('Get customers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).lean();

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (err) {
    console.error('Get customer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const BACKEND_CREATE_LOG = true;
function _logCreate(payload) {
  if (!BACKEND_CREATE_LOG) return;
  try { console.info('[BACKEND-CREATE]', payload); } catch { void 0; }
}
function _reqId(req, fallbackPrefix = 'cust') {
  const h = req?.headers?.['x-request-id'];
  if (h && String(h).trim()) return String(h).trim();
  return `${fallbackPrefix}_srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

router.post('/', async (req, res) => {
  const requestId = _reqId(req, 'cust');
  const endpoint = 'POST /api/customers';
  try {
    const validated = createCustomerSchema.parse(req.body);
    const now = new Date().toISOString();
    const userId = req.user.id;

    const same = (a, b) => {
      const sa = String(a || '').trim().toLowerCase();
      const sb = String(b || '').trim().toLowerCase();
      return !!sa && sa === sb;
    };
    const orClauses = [];
    if (validated.email) orClauses.push({ email: validated.email });
    if (validated.name) orClauses.push({ name: { $regex: new RegExp(`^${String(validated.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    if (orClauses.length) {
      const hit = await Customer.findOne({ userId, $or: orClauses }).lean();
      if (hit && (same(hit.email, validated.email) || same(hit.name, validated.name))) {
        _logCreate({ timestamp: new Date().toISOString(), endpoint, requestId, entityId: String(hit._id ?? ''), name: hit.name, email: hit.email, deduped: true });
        return res.status(200).json(hit);
      }
    }

    const customer = new Customer({
      ...validated,
      userId,
      createdAt: validated.createdAt || now,
      updatedAt: now,
    });
    await customer.save();
    const saved = customer.toObject();
    _logCreate({ timestamp: new Date().toISOString(), endpoint, requestId, entityId: String(saved._id ?? ''), name: saved.name, email: saved.email, deduped: false });
    res.status(201).json(saved);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Customer already exists' });
    }
    console.error('Create customer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/batch', async (req, res) => {
  const requestId = _reqId(req, 'cust_batch');
  const endpoint = 'POST /api/customers/batch';
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
      await Customer.insertMany(docs, { ordered: false });
    }

    _logCreate({ timestamp: new Date().toISOString(), endpoint, requestId, entityId: null, created: docs.length, batch: true });
    res.status(201).json({ created: docs.length });
  } catch (err) {
    console.error('Batch create customers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const validated = updateCustomerSchema.parse(req.body);
    const now = new Date().toISOString();

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { ...validated, updatedAt: now },
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer.toObject());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Update customer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await Customer.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!result) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted' });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/', async (req, res) => {
  try {
    await Customer.deleteMany({ userId: req.user.id });
    res.json({ message: 'All customers deleted' });
  } catch (err) {
    console.error('Delete all customers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
