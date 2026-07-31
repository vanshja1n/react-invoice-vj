import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import invoiceRoutes from './routes/invoices.js';
import productRoutes from './routes/products.js';
import customerRoutes from './routes/customers.js';
import inventoryRoutes from './routes/inventory.js';
import settingsRoutes from './routes/settings.js';
import subscriptionRoutes from './routes/subscriptions.js';
import syncRoutes from './routes/sync.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/inventory-history', inventoryRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/sync', syncRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn('MONGODB_URI not set. Server will start without MongoDB connection.');
    } else {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });

      console.log('Connected to MongoDB');
    }

    app.listen(PORT, () => {
      console.log(`InvoiceHub server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
