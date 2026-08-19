/**
 * Acceso a variables de entorno con fallo temprano y mensajes claros.
 *
 * Regla: la service-role key jamás debe leerse desde código de cliente. Por eso
 * vive en su propia función, separada de las claves públicas.
 */

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Cópiala desde .env.example al .env.local de la app.`,
    );
  }
  return value;
}

export function getPublicSupabaseConfig(): { url: string; anonKey: string } {
  return {
    // Next.js sustituye estas referencias en build; deben escribirse literalmente.
    url: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}

export function getServiceRoleKey(): string {
  if (typeof window !== 'undefined') {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY solo puede usarse en servidor. ' +
        'Mueve esta llamada a un Route Handler o Server Action.',
    );
  }
  return requireEnv('SUPABASE_SERVICE_ROLE_KEY');
}

export function getSiteUrl(): string {
  return readEnv('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000';
}

export function getBrandName(): string {
  return readEnv('NEXT_PUBLIC_BRAND_NAME') ?? 'Nébula Store';
}
