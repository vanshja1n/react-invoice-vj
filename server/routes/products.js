import Router from 'express';
import { z } from 'zod';
import Product from '../models/Product.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const SKU_PATTERN = /^PRD-(\d+)$/;

/**
 * Generate the next sequential PRD-###### SKU for a given user.
 * Scans all existing PRD-###### SKUs for that user and returns
 * PRD-(max+1), zero-padded to 6 digits.
 */
async function _generateNextSku(userId) {
  const existing = await Product.find(
    { userId, sku: { $regex: /^PRD-\d{6,}$/ } },
    { sku: 1, _id: 0 },
  ).lean();
  let max = 0;
  for (const p of existing) {
    const m = String(p.sku || '').match(SKU_PATTERN);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `PRD-${String(max + 1).padStart(6, '0')}`;
}

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

const BACKEND_CREATE_LOG = true;
function _logCreate(payload) {
  if (!BACKEND_CREATE_LOG) return;
  try { console.info('[BACKEND-CREATE]', payload); } catch { void 0; }
}
function _reqId(req, fallbackPrefix = 'prod') {
  const h = req?.headers?.['x-request-id'];
  if (h && String(h).trim()) return String(h).trim();
  return `${fallbackPrefix}_srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

router.post('/', async (req, res) => {
  const requestId = _reqId(req, 'prod');
  const endpoint = 'POST /api/products';
  try {
    const validated = createProductSchema.parse(req.body);
    const now = new Date().toISOString();
    const userId = req.user.id;

    const same = (a, b) => {
      const sa = String(a || '').trim().toLowerCase();
      const sb = String(b || '').trim().toLowerCase();
      return !!sa && sa === sb;
    };
    const hit = await Product.findOne({
      userId,
      $or: [
        ...(validated.sku ? [{ sku: validated.sku }] : []),
        ...(validated.name ? [{ name: { $regex: new RegExp(`^${String(validated.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }] : []),
      ],
    }).lean();
    if (hit && (same(hit.sku, validated.sku) || same(hit.name, validated.name))) {
      _logCreate({ timestamp: new Date().toISOString(), endpoint, requestId, entityId: String(hit._id ?? ''), name: hit.name, sku: hit.sku, deduped: true });
      return res.status(200).json(hit);
    }

    // Auto-generate a sequential SKU if the client did not supply one.
    // This guarantees every product in MongoDB has a proper PRD-###### SKU,
    // even when created via direct API calls or by older client versions.
    const sku = validated.sku && String(validated.sku).trim()
      ? validated.sku
      : await _generateNextSku(userId);

    const product = new Product({
      ...validated,
      sku,
      userId,
      createdAt: validated.createdAt || now,
      updatedAt: now,
    });
    await product.save();
    const saved = product.toObject();
    _logCreate({ timestamp: new Date().toISOString(), endpoint, requestId, entityId: String(saved._id ?? ''), name: saved.name, sku: saved.sku, deduped: false });
    res.status(201).json(saved);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/batch', async (req, res) => {
  const requestId = _reqId(req, 'prod_batch');
  const endpoint = 'POST /api/products/batch';
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
      await Product.insertMany(docs, { ordered: false });
    }

    _logCreate({ timestamp: new Date().toISOString(), endpoint, requestId, entityId: null, created: docs.length, batch: true });
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
