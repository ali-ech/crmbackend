import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import listingRoutes from './routes/listings.js';
import leadRoutes from './routes/leads.js';
import publicRoutes from './routes/public.js';
import taskRoutes from './routes/tasks.js';
import notificationRoutes from './routes/notifications.js';
import whatsappRoutes from './routes/whatsapp.js';
import analyticsRoutes from './routes/analytics.js';
import uploadRoutes from './routes/uploads.js';

const app = express();

const allowedOrigins = [
  env.publicSiteUrl,
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/uploads', uploadRoutes);

app.use(errorHandler);

export default app;
