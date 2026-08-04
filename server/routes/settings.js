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

    console.info('[Settings PUT] req.body keys:', Object.keys(req.body));
    console.info('[Settings PUT] validated:', JSON.stringify({
      ...validated,
      companyLogo: validated.companyLogo ? `[base64 ${validated.companyLogo.length} chars]` : validated.companyLogo,
    }));

    const before = await Settings.findOne({ userId: req.user.id }).lean();
    console.info('[Settings PUT] MongoDB BEFORE:', before ? JSON.stringify({
      companyName: before.companyName,
      companyLogo: before.companyLogo ? `[base64 ${before.companyLogo.length} chars]` : before.companyLogo,
      gstNumber: before.gstNumber,
      updatedAt: before.updatedAt,
    }) : 'null (no existing document)');

    const settings = await Settings.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { ...validated, userId: req.user.id } },
      { upsert: true, new: true, runValidators: true }
    );

    const result = settings.toObject();
    console.info('[Settings PUT] MongoDB AFTER:', JSON.stringify({
      companyName: result.companyName,
      companyLogo: result.companyLogo ? `[base64 ${result.companyLogo.length} chars]` : result.companyLogo,
      gstNumber: result.gstNumber,
      updatedAt: result.updatedAt,
    }));

    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error('[Settings PUT] Zod validation error:', err.errors);
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
