import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, HonoVariables } from './types';
import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

app.use('*', cors({
  origin: (origin) => origin,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'CF-Access-Jwt-Assertion', 'X-Dev-Email'],
  credentials: true,
}));

app.get('/api/health', (c) => c.json({ status: 'ok' }));

// All /api/auth/* routes require authentication
app.use('/api/auth/*', authMiddleware);
app.route('/api/auth', authRoutes);

export default app;
