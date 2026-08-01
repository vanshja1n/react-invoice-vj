import Router from 'express';
import { z } from 'zod';
import InventoryHistory from '../models/InventoryHistory.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const recordSchema = z.object({
  productId: z.any().optional(),
  productName: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  action: z.string().optional(),
  previousStock: z.number().optional(),
  quantityChanged: z.number().optional(),
  newStock: z.number().optional(),
  reference: z.string().optional().nullable(),
});

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const records = await InventoryHistory.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(records);
  } catch (err) {
    console.error('Get inventory history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const BACKEND_CREATE_LOG = true;
function _logCreate(payload) {
  if (!BACKEND_CREATE_LOG) return;
  try { console.info('[BACKEND-CREATE]', payload); } catch { void 0; }
}
function _reqId(req, fallbackPrefix = 'invhist') {
  const h = req?.headers?.['x-request-id'];
  if (h && String(h).trim()) return String(h).trim();
  return `${fallbackPrefix}_srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

router.post('/', async (req, res) => {
  const requestId = _reqId(req, 'invhist');
  const endpoint = 'POST /api/inventory-history';
  try {
    const validated = recordSchema.parse(req.body);
    const now = new Date().toISOString();

    const record = new InventoryHistory({
      ...validated,
      userId: req.user.id,
      createdAt: validated.createdAt || now,
    });
    await record.save();
    const saved = record.toObject();
    _logCreate({ timestamp: new Date().toISOString(), endpoint, requestId, entityId: String(saved._id ?? ''), action: saved.action, productId: saved.productId });
    res.status(201).json(saved);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Create inventory record error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/batch', async (req, res) => {
  const requestId = _reqId(req, 'invhist_batch');
  const endpoint = 'POST /api/inventory-history/batch';
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    const now = new Date().toISOString();
    const userId = req.user.id;

    const docs = items.map((item) => ({
      ...item,
      userId,
      createdAt: item.createdAt || now,
    }));

    if (docs.length > 0) {
      await InventoryHistory.insertMany(docs, { ordered: false });
    }

    _logCreate({ timestamp: new Date().toISOString(), endpoint, requestId, entityId: null, created: docs.length, batch: true });
    res.status(201).json({ created: docs.length });
  } catch (err) {
    console.error('Batch create inventory history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/', async (req, res) => {
  try {
    await InventoryHistory.deleteMany({ userId: req.user.id });
    res.json({ message: 'All inventory history deleted' });
  } catch (err) {
    console.error('Delete all inventory history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
