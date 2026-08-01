import Router from 'express';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import InventoryHistory from '../models/InventoryHistory.js';
import Settings from '../models/Settings.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const [invoices, products, customers, inventoryHistory, settings] = await Promise.all([
      Invoice.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean(),
      Product.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean(),
      Customer.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean(),
      InventoryHistory.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean(),
      Settings.findOne({ userId: req.user.id }).lean(),
    ]);

    res.json({
      version: 3,
      exportedAt: new Date().toISOString(),
      invoices,
      products,
      customers,
      inventoryHistory,
      settings: settings || {},
    });
  } catch (err) {
    console.error('Sync pull error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function buildDocsForPush(items, userId, now, includeUpdatedAt = true) {
  const strip = (doc) => {
    const { _id, __v, userId: _uid, ...rest } = doc;
    return rest;
  };
  return items.map((item) => ({
    ...strip(item),
    userId,
    createdAt: item.createdAt || now,
    ...(includeUpdatedAt ? { updatedAt: item.updatedAt || now } : {}),
  }));
}

async function runPushWithTransaction(session, req, now) {
  const { invoices = [], products = [], customers = [], inventoryHistory = [], settings = null } = req.body;
  const userId = req.user.id;

  const results = { invoices: 0, products: 0, customers: 0, inventoryHistory: 0, settings: false };

  if (invoices.length > 0) {
    const docs = buildDocsForPush(invoices, userId, now, true);
    await Invoice.deleteMany({ userId }).session(session);
    await Invoice.insertMany(docs, { ordered: false, session });
    results.invoices = docs.length;
  } else {
    await Invoice.deleteMany({ userId }).session(session);
  }

  if (products.length > 0) {
    const docs = buildDocsForPush(products, userId, now, true);
    await Product.deleteMany({ userId }).session(session);
    await Product.insertMany(docs, { ordered: false, session });
    results.products = docs.length;
  } else {
    await Product.deleteMany({ userId }).session(session);
  }

  if (customers.length > 0) {
    const docs = buildDocsForPush(customers, userId, now, true);
    await Customer.deleteMany({ userId }).session(session);
    await Customer.insertMany(docs, { ordered: false, session });
    results.customers = docs.length;
  } else {
    await Customer.deleteMany({ userId }).session(session);
  }

  if (inventoryHistory.length > 0) {
    const docs = buildDocsForPush(inventoryHistory, userId, now, false);
    await InventoryHistory.deleteMany({ userId }).session(session);
    await InventoryHistory.insertMany(docs, { ordered: false, session });
    results.inventoryHistory = docs.length;
  } else {
    await InventoryHistory.deleteMany({ userId }).session(session);
  }

  if (settings) {
    const { _id, __v, userId: _uid, ...settingsRest } = settings;
    await Settings.findOneAndUpdate(
      { userId },
      { ...settingsRest, userId },
      { upsert: true, new: true, session }
    );
    results.settings = true;
  } else {
    await Settings.deleteMany({ userId }).session(session);
  }

  return results;
}

async function runPushWithoutSession(req, now) {
  const { invoices = [], products = [], customers = [], inventoryHistory = [], settings = null } = req.body;
  const userId = req.user.id;

  const results = { invoices: 0, products: 0, customers: 0, inventoryHistory: 0, settings: false };

  if (invoices.length > 0) {
    const docs = buildDocsForPush(invoices, userId, now, true);
    await Invoice.deleteMany({ userId });
    await Invoice.insertMany(docs, { ordered: false });
    results.invoices = docs.length;
  } else {
    await Invoice.deleteMany({ userId });
  }

  if (products.length > 0) {
    const docs = buildDocsForPush(products, userId, now, true);
    await Product.deleteMany({ userId });
    await Product.insertMany(docs, { ordered: false });
    results.products = docs.length;
  } else {
    await Product.deleteMany({ userId });
  }

  if (customers.length > 0) {
    const docs = buildDocsForPush(customers, userId, now, true);
    await Customer.deleteMany({ userId });
    await Customer.insertMany(docs, { ordered: false });
    results.customers = docs.length;
  } else {
    await Customer.deleteMany({ userId });
  }

  if (inventoryHistory.length > 0) {
    const docs = buildDocsForPush(inventoryHistory, userId, now, false);
    await InventoryHistory.deleteMany({ userId });
    await InventoryHistory.insertMany(docs, { ordered: false });
    results.inventoryHistory = docs.length;
  } else {
    await InventoryHistory.deleteMany({ userId });
  }

  if (settings) {
    const { _id, __v, userId: _uid, ...settingsRest } = settings;
    await Settings.findOneAndUpdate(
      { userId },
      { ...settingsRest, userId },
      { upsert: true, new: true }
    );
    results.settings = true;
  } else {
    await Settings.deleteMany({ userId });
  }

  return results;
}

router.post('/push', async (req, res) => {
  const now = new Date().toISOString();
  let session = null;
  try {
    session = await mongoose.startSession().catch(() => null);

    if (session && typeof session.withTransaction === 'function') {
      let txnResults = null;
      try {
        await session.withTransaction(async () => {
          txnResults = await runPushWithTransaction(session, req, now);
        }, {
          readPreference: 'primary',
          readConcern: { level: 'local' },
          writeConcern: { w: 'majority' },
        });
        res.json({ message: 'Sync push complete (transactional)', results: txnResults, transactional: true });
        return;
      } catch (txnErr) {
        const txnMsg = txnErr?.message || String(txnErr);
        if (txnMsg.includes('Transaction numbers are only allowed') || txnMsg.includes('replica set') || txnMsg.includes('sharded cluster') || txnMsg.includes('transactions are not supported')) {
          console.warn('[SYNC-PUSH] MongoDB transactions unsupported by current deployment — falling back to non-transactional push.', txnMsg);
        } else {
          console.error('[SYNC-PUSH] Transaction push failed (will retry non-transactional):', txnErr);
        }
      }
    }

    const results = await runPushWithoutSession(req, now);
    res.json({ message: 'Sync push complete (non-transactional fallback)', results, transactional: false });
  } catch (err) {
    console.error('Sync push error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (session) {
      try { await session.endSession(); } catch { void 0; }
    }
  }
});

export default router;
