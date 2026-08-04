import Router from 'express';
import { z } from 'zod';
import Settings from '../models/Settings.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const settingsSchema = z.object({
  companyName: z.string().optional().nullable(),
  companyAddress: z.string().optional().nullable(),
  companyPhone: z.string().optional().nullable(),
  companyEmail: z.string().optional().nullable(),
  companyLogo: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  defaultTax: z.number().optional(),
  defaultCurrency: z.string().optional(),
  defaultNotes: z.string().optional(),
  defaultTerms: z.string().optional(),
  defaultInvoiceTemplate: z.string().optional(),
  theme: z.string().optional(),
});

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne({ userId: req.user.id }).lean();
    if (!settings) {
      settings = {};
    }
    res.json(settings);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/', async (req, res) => {
  try {
    const validated = settingsSchema.parse(req.body);

    const settings = await Settings.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { ...validated, userId: req.user.id } },
      { upsert: true, new: true, runValidators: true }
    );

    res.json(settings.toObject());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
