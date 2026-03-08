import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import proxy from '@fastify/http-proxy';
import jwt from '@fastify/jwt';
import { randomUUID } from 'node:crypto';
import { config } from '../../../packages/shared-config/src';

const app = Fastify({ logger: true });
await app.register(cors);
await app.register(helmet);
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
await app.register(jwt, { secret: config.jwtSecret });

app.addHook('onRequest', async (request, reply) => {
  const correlationId = String(request.headers['x-correlation-id'] ?? randomUUID());
  request.headers['x-correlation-id'] = correlationId;

  const publicPaths = ['/health', '/ready', '/auth/login', '/auth/refresh'];
  const isPublic = publicPaths.some((path) => request.url.startsWith(path));
  if (!isPublic) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Unauthorized', correlationId });
    }
  }
});

app.get('/health', async () => ({ status: 'ok', service: 'api-gateway' }));
app.get('/ready', async () => ({ status: 'ready' }));

const routes = [
  { prefix: '/auth', upstream: 'http://identity-service:3001' },
  { prefix: '/users', upstream: 'http://user-service:3002' },
  { prefix: '/roles', upstream: 'http://authorization-service:3003' },
  { prefix: '/permissions', upstream: 'http://authorization-service:3003' },
  { prefix: '/groups', upstream: 'http://authorization-service:3003' },
  { prefix: '/approvals', upstream: 'http://approval-service:3005' },
  { prefix: '/workflows', upstream: 'http://workflow-service:3004' },
  { prefix: '/automation', upstream: 'http://automation-service:3006' },
  { prefix: '/notifications', upstream: 'http://notification-service:3007' },
  { prefix: '/dashboard', upstream: 'http://dashboard-service:3008' },
  { prefix: '/audit', upstream: 'http://audit-service:3009' },
  { prefix: '/reports', upstream: 'http://audit-service:3009' },
  { prefix: '/integrations', upstream: 'http://integration-service:3010' }
];

for (const route of routes) {
  await app.register(proxy, {
    upstream: route.upstream,
    prefix: route.prefix,
    replyOptions: {
      rewriteRequestHeaders: (req, headers) => ({
        ...headers,
        'x-correlation-id': String(req.headers['x-correlation-id'])
      })
    }
  });
}

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.listen({ host: '0.0.0.0', port: config.port });
