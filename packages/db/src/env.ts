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

/**
 * Configuración pública de Supabase.
 *
 * Las dos referencias se escriben **literales** —`process.env.NOMBRE`— y no con
 * el ayudante `readEnv(nombre)`. La diferencia parece cosmética y no lo es:
 * Next.js sustituye en compilación las referencias literales a `NEXT_PUBLIC_*`
 * por su valor, y una lectura dinámica `process.env[nombre]` no la reconoce.
 *
 * Con el ayudante, esto funcionaba en `next build` —donde el proceso sí tiene
 * las variables— y fallaba en el Worker ya desplegado, donde `process.env` solo
 * trae lo que se cargó en Cloudflare. El síntoma era desconcertante:
 * `isSupabaseConfigured()` decía que sí (usa referencias literales) y acto
 * seguido crear el cliente lanzaba «falta la variable de entorno». Tienda,
 * fichas y páginas del CMS respondían 500 mientras las páginas estáticas se
 * veían perfectas.
 */
export function getPublicSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'En local se copian de .env.example a .env.local; en un despliegue tienen ' +
        'que estar presentes en el momento de compilar, porque viajan dentro del paquete.',
    );
  }

  return { url, anonKey };
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

// Mismo motivo que arriba: literales, para que Next las sustituya en compilación.
export function getSiteUrl(): string {
  const valor = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return valor && valor.length > 0 ? valor : 'http://localhost:3000';
}

export function getBrandName(): string {
  const valor = process.env.NEXT_PUBLIC_BRAND_NAME?.trim();
  return valor && valor.length > 0 ? valor : 'Nébula Store';
}
