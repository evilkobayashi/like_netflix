import type { FastifyRequest } from 'fastify';

export function requirePermission(request: FastifyRequest, permission: string): void {
  const authRequest = request as FastifyRequest & { user?: { permissions?: string[] } };
  const permissions = authRequest.user?.permissions ?? [];
  if (!permissions.includes(permission)) {
    const error = new Error(`Missing permission ${permission}`) as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
}
