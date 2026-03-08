import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { config } from '../../../packages/shared-config/src';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
await app.register(jwt, { secret: config.jwtSecret });
app.addHook('preHandler', async (request) => request.jwtVerify());

app.get('/integrations/endpoints', async (request) => prisma.integrationEndpoint.findMany({ where: { tenantId: (request.user as any).tenantId } }));
app.post('/integrations/endpoints', async (request) => prisma.integrationEndpoint.create({ data: { tenantId: (request.user as any).tenantId, ...(request.body as any) } }));
app.listen({ host: '0.0.0.0', port: config.port });
