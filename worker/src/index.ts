import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, HonoVariables } from './types';
import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth';
import clubSettingsRoutes from './routes/clubSettings';
import homepageStatsRoutes from './routes/homepageStats';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

app.use('*', cors({
  origin: (origin) => origin,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'CF-Access-Jwt-Assertion', 'X-Dev-Email'],
  credentials: true,
}));

app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.use('/api/auth/*', authMiddleware);
app.route('/api/auth', authRoutes);

app.route('/api/club-settings', clubSettingsRoutes);
app.route('/api/homepage-stats', homepageStatsRoutes);

export default app;
