import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, HonoVariables } from './types';
import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth';
import clubSettingsRoutes from './routes/clubSettings';
import homepageStatsRoutes from './routes/homepageStats';
import uploadsRoutes from './routes/uploads';
import seasonsRoutes from './routes/seasons';
import eoiRoutes from './routes/eoi';
import teamsRoutes from './routes/teams';
import usersRoutes from './routes/users';
import playersRoutes from './routes/players';
import roleRequestsRoutes from './routes/roleRequests';
import { coachesRouter, managersRouter, parentsRouter } from './routes/coaches';
import feedbackRoutes from './routes/feedback';

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
app.route('/api', uploadsRoutes);
app.route('/api/seasons', seasonsRoutes);
app.route('/api/eoi', eoiRoutes);
app.route('/api/teams', teamsRoutes);
app.route('/api/users', usersRoutes);
app.route('/api/players', playersRoutes);
app.route('/api/coaches', coachesRouter);
app.route('/api/managers', managersRouter);
app.route('/api/parents', parentsRouter);
app.route('/api/feedback', feedbackRoutes);
app.route('/api/role-requests', roleRequestsRoutes);

// Serve R2 uploads — must come before the Assets fallback
app.get('/uploads/:category/:filename', async (c) => {
  const key = `${c.req.param('category')}/${c.req.param('filename')}`;
  const obj = await c.env.UPLOADS.get(key);
  if (!obj) return c.json({ error: 'Not found' }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  return new Response(obj.body, { headers });
});

// Fall through to Workers Assets (serves frontend/dist) for all non-API routes
app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
