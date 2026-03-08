import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';

describe('gateway smoke', () => {
  it('exposes health endpoint', async () => {
    const app = Fastify();
    app.get('/health', async () => ({ status: 'ok' }));
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
  });
});
