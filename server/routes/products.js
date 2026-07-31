import Router from 'express';
import { z } from 'zod';
import Product from '../models/Product.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const baseProductSchema = z.object({
  name: z.string().optional(),
  sku: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  costPrice: z.number().optional(),
  sellingPrice: z.number().optional(),
  currentStock: z.number().optional(),
  lowStockAlert: z.number().optional(),
  unit: z.string().optional().nullable(),
  taxRate: z.number().optional(),
  hsnCode: z.string().optional().nullable(),
});

const createProductSchema = baseProductSchema.refine(
  (data) => data.name && data.name.trim().length > 0,
  { message: 'Name is required', path: ['name'] }
);
const updateProductSchema = baseProductSchema.partial();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(products);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).lean();

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const validated = createProductSchema.parse(req.body);
    const now = new Date().toISOString();

    const product = new Product({
      ...validated,
      userId: req.user.id,
      createdAt: validated.createdAt || now,
      updatedAt: now,
    });
    await product.save();

    res.status(201).json(product.toObject());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Create product error:', err);
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
      await Product.insertMany(docs, { ordered: false });
    }

    res.status(201).json({ created: docs.length });
  } catch (err) {
    console.error('Batch create products error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const validated = updateProductSchema.parse(req.body);
    const now = new Date().toISOString();

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { ...validated, updatedAt: now },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product.toObject());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await Product.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!result) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/', async (req, res) => {
  try {
    await Product.deleteMany({ userId: req.user.id });
    res.json({ message: 'All products deleted' });
  } catch (err) {
    console.error('Delete all products error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
