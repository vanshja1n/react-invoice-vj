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

router.post('/', async (req, res) => {
  try {
    const validated = recordSchema.parse(req.body);
    const now = new Date().toISOString();

    const record = new InventoryHistory({
      ...validated,
      userId: req.user.id,
      createdAt: validated.createdAt || now,
    });
    await record.save();

    res.status(201).json(record.toObject());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Create inventory record error:', err);
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
    }));

    if (docs.length > 0) {
      await InventoryHistory.insertMany(docs, { ordered: false });
    }

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
