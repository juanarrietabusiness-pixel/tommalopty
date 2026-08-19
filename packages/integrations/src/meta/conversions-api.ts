import { buildCustomData, type MetaCustomData, type MetaEventName } from './events';
import { hashUserData } from './hash';

/**
 * Meta Conversions API (seguimiento en servidor).
 *
 * Enviar los eventos desde el servidor evita la pérdida de datos que provocan
 * los bloqueadores de anuncios (brief §2). Se ejecuta con `fetch`, así que
 * funciona igual en un Route Handler de Next, en un Worker de Cloudflare o en
 * una Edge Function de Supabase.
 *
 * La versión de la Graph API es configurable: conviene revisarla al menos una
 * vez al año porque Meta deja de dar soporte a las versiones antiguas.
 */
const DEFAULT_API_VERSION = 'v21.0';

export interface ConversionEventInput {
  eventName: MetaEventName;
  /** Compartido con el Pixel del navegador para deduplicar. */
  eventId: string;
  eventTime?: number;
  eventSourceUrl?: string;
  actionSource?: 'website' | 'email' | 'phone_call' | 'chat' | 'other';
  user: {
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    city?: string | null;
    countryCode?: string | null;
    /** Cookies `_fbp` y `_fbc` del navegador: mejoran mucho el emparejamiento. */
    fbp?: string | null;
    fbc?: string | null;
    clientIpAddress?: string | null;
    clientUserAgent?: string | null;
  };
  customData?: MetaCustomData;
}

export interface ConversionApiResult {
  sent: boolean;
  /** Motivo por el que no se envió (falta de configuración, error de red…). */
  reason?: string;
  eventsReceived?: number;
}

function getConfig() {
  return {
    pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID,
    accessToken: process.env.META_CONVERSIONS_ACCESS_TOKEN,
    testEventCode: process.env.META_TEST_EVENT_CODE,
    apiVersion: process.env.META_API_VERSION ?? DEFAULT_API_VERSION,
  };
}

export function isConversionsApiConfigured(): boolean {
  const { pixelId, accessToken } = getConfig();
  return Boolean(pixelId && accessToken);
}

/**
 * Envía un evento a la Conversions API.
 *
 * Nunca lanza: el seguimiento de marketing no debe tumbar un checkout. Los
 * fallos se devuelven en el resultado para que quien llama decida si registrarlos.
 */
export async function sendConversionEvent(
  input: ConversionEventInput,
): Promise<ConversionApiResult> {
  const { pixelId, accessToken, testEventCode, apiVersion } = getConfig();

  if (!pixelId || !accessToken) {
    return { sent: false, reason: 'meta_not_configured' };
  }

  try {
    const userData = await hashUserData(input.user);

    // fbp/fbc e IP no se hashean: Meta los espera en claro.
    if (input.user.fbp) userData.fbp = [input.user.fbp];
    if (input.user.fbc) userData.fbc = [input.user.fbc];

    const event: Record<string, unknown> = {
      event_name: input.eventName,
      event_id: input.eventId,
      event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
      action_source: input.actionSource ?? 'website',
      user_data: {
        ...userData,
        ...(input.user.clientIpAddress ? { client_ip_address: input.user.clientIpAddress } : {}),
        ...(input.user.clientUserAgent ? { client_user_agent: input.user.clientUserAgent } : {}),
      },
    };

    if (input.eventSourceUrl) event.event_source_url = input.eventSourceUrl;
    if (input.customData) event.custom_data = buildCustomData(input.customData);

    const body: Record<string, unknown> = { data: [event] };
    if (testEventCode) body.test_event_code = testEventCode;

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      return { sent: false, reason: `meta_http_${response.status}` };
    }

    const result = (await response.json()) as { events_received?: number };
    return { sent: true, eventsReceived: result.events_received };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : 'meta_unknown_error',
    };
  }
}
