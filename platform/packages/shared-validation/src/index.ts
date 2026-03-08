import { z } from 'zod';

export const tenantHeaderSchema = z.object({ 'x-tenant-id': z.string().min(1) });
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8), tenantId: z.string().min(1) });
