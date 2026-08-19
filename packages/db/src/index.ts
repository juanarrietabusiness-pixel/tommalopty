export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
  Views,
  Enums,
} from './generated/database.types';

export { createSupabaseBrowserClient } from './client/browser';
export { createSupabaseServerClient, type CookieAdapter } from './client/server';
export { createSupabaseServiceClient } from './client/service';
export { getPublicSupabaseConfig, getSiteUrl, getBrandName } from './env';

export * from './repositories/catalog';
export * from './repositories/cms';
export * from './repositories/orders';
export * from './repositories/customers';
export * from './repositories/reports';
