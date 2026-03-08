export const config = {
  serviceName: process.env.SERVICE_NAME ?? 'service',
  port: Number(process.env.PORT ?? 3000),
  postgresUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@postgres:5432/platform',
  redisUrl: process.env.REDIS_URL ?? 'redis://redis:6379',
  natsUrl: process.env.NATS_URL ?? 'nats://nats:4222',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  tokenTtl: process.env.JWT_TTL ?? '15m'
};
