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

router.post('/', async (req, res) => {
  try {
    const validated = createCustomerSchema.parse(req.body);
    const now = new Date().toISOString();

    const customer = new Customer({
      ...validated,
      userId: req.user.id,
      createdAt: validated.createdAt || now,
      updatedAt: now,
    });
    await customer.save();

    res.status(201).json(customer.toObject());
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
      await Customer.insertMany(docs, { ordered: false });
    }

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
