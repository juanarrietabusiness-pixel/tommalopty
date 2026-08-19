/**
 * Normalización + SHA-256 de datos personales antes de enviarlos a Meta.
 *
 * Meta exige que email, teléfono y nombre viajen hasheados. Se usa Web Crypto
 * (no `node:crypto`) para que funcione igual en Node, en Cloudflare Workers y
 * en Supabase Edge Functions.
 */
export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Meta espera el teléfono en formato E.164 sin símbolos (Panamá: 507…). */
export function normalizePhone(phone: string, defaultCountryCode = '507'): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.startsWith(defaultCountryCode)) return digits;
  return `${defaultCountryCode}${digits}`;
}

export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export async function hashUserData(input: {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  countryCode?: string | null;
}): Promise<Record<string, string[]>> {
  const userData: Record<string, string[]> = {};

  if (input.email) userData.em = [await sha256Hex(normalizeEmail(input.email))];
  if (input.phone) userData.ph = [await sha256Hex(normalizePhone(input.phone))];
  if (input.firstName) userData.fn = [await sha256Hex(normalizeName(input.firstName))];
  if (input.lastName) userData.ln = [await sha256Hex(normalizeName(input.lastName))];
  if (input.city) userData.ct = [await sha256Hex(normalizeName(input.city))];
  if (input.countryCode) userData.country = [await sha256Hex(input.countryCode.toLowerCase())];

  return userData;
}
