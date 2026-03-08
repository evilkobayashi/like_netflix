export type TenantContext = { tenantId: string; userId: string; permissions: string[]; correlationId: string };
export type ApiResponse<T> = { data: T; correlationId: string };
export type Paginated<T> = { items: T[]; total: number };
