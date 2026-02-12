import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import routes from './routes';
import subscriptionRoutes from './routes/subscription';

dotenv.config();

// Production: require secrets to be set and not use default placeholders
if (process.env.NODE_ENV === 'production') {
  const defaults = ['dev-secret-change-in-production', 'default-secret-change-in-production', ''];
  const jwtSecret = process.env.JWT_SECRET;
  const appSecret = process.env.APP_SECRET;
  if (!jwtSecret || defaults.includes(jwtSecret)) {
    console.error('Fatal: JWT_SECRET must be set to a strong random value in production (e.g. openssl rand -hex 32)');
    process.exit(1);
  }
  if (!appSecret || defaults.includes(appSecret)) {
    console.error('Fatal: APP_SECRET must be set to a strong random value in production');
    process.exit(1);
  }
}

// Debug: Check DATABASE_URL (don't log full value - contains password)
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);

}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
}));
// Stripe webhook needs raw body, so we handle it before json parser
app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', routes);
app.use('/', subscriptionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

