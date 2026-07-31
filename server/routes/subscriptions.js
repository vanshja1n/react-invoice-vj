import Router from 'express';
import Subscription from '../models/Subscription.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    let subscription = await Subscription.findOne({ userId: req.user.id }).lean();
    if (!subscription) {
      subscription = {
        userId: req.user.id,
        plan: 'free',
        status: 'active',
      };
    }
    res.json(subscription);
  } catch (err) {
    console.error('Get subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
