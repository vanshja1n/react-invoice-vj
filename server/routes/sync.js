import Router from 'express';
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

router.post('/push', async (req, res) => {
  try {
    const { invoices = [], products = [], customers = [], inventoryHistory = [], settings = null } = req.body;
    const userId = req.user.id;
    const now = new Date().toISOString();

    const strip = (doc) => {
      const { _id, __v, userId: _uid, ...rest } = doc;
      return rest;
    };

    const results = { invoices: 0, products: 0, customers: 0, inventoryHistory: 0, settings: false };

    if (invoices.length > 0) {
      const invoiceDocs = invoices.map((item) => ({
        ...strip(item),
        userId,
        createdAt: item.createdAt || now,
        updatedAt: item.updatedAt || now,
      }));
      await Invoice.deleteMany({ userId });
      await Invoice.insertMany(invoiceDocs, { ordered: false });
      results.invoices = invoiceDocs.length;
    }

    if (products.length > 0) {
      const productDocs = products.map((item) => ({
        ...strip(item),
        userId,
        createdAt: item.createdAt || now,
        updatedAt: item.updatedAt || now,
      }));
      await Product.deleteMany({ userId });
      await Product.insertMany(productDocs, { ordered: false });
      results.products = productDocs.length;
    }

    if (customers.length > 0) {
      const customerDocs = customers.map((item) => ({
        ...strip(item),
        userId,
        createdAt: item.createdAt || now,
        updatedAt: item.updatedAt || now,
      }));
      await Customer.deleteMany({ userId });
      await Customer.insertMany(customerDocs, { ordered: false });
      results.customers = customerDocs.length;
    }

    if (inventoryHistory.length > 0) {
      const invDocs = inventoryHistory.map((item) => ({
        ...strip(item),
        userId,
        createdAt: item.createdAt || now,
      }));
      await InventoryHistory.deleteMany({ userId });
      await InventoryHistory.insertMany(invDocs, { ordered: false });
      results.inventoryHistory = invDocs.length;
    }

    if (settings) {
      const { _id, __v, userId: _uid, ...settingsRest } = settings;
      await Settings.findOneAndUpdate(
        { userId },
        { ...settingsRest, userId },
        { upsert: true }
      );
      results.settings = true;
    }

    res.json({ message: 'Sync push complete', results });
  } catch (err) {
    console.error('Sync push error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
