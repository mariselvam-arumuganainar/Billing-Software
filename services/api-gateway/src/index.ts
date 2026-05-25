// dotenv is preloaded via `-r dotenv/config` in the dev script so process.env
// is fully populated before any module-level code in auth.ts or authController.ts runs.
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import itemsRoutes from './routes/items';
import customersRoutes from './routes/customers';
import creditRoutes from './routes/credit';
import expensesRoutes from './routes/expenses';
import reportsRoutes from './routes/reports';
import settingsRoutes from './routes/settings';
import billingRoutes from './routes/billing';
import remindersRoutes from './routes/reminders';
import stockRoutes from './routes/stock';

const app = express();
const port = process.env.PORT || 4000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no Origin header) and listed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: origin not allowed'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/items', itemsRoutes);
app.use('/api/v1/customers', customersRoutes);
app.use('/api/v1/credit', creditRoutes);
app.use('/api/v1/expenses', expensesRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/billing',   billingRoutes);
app.use('/api/v1/reminders', remindersRoutes);
app.use('/api/v1/stock',     stockRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'api-gateway' });
});

app.listen(port, () => {
  console.log(`API Gateway is running on port ${port}`);
});

