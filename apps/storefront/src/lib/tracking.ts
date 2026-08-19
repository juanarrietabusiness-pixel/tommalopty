import { headers } from 'next/headers';
import { cookies } from 'next/headers';
import { meta } from '@nebula/integrations';

/**
 * Envío de eventos a la Conversions API desde el servidor, completando el
 * contexto de la petición (IP, user-agent, cookies `_fbp`/`_fbc`) que Meta usa
 * para emparejar conversiones.
 *
 * Nunca lanza: un fallo de marketing no puede tumbar un checkout.
 */
export async function sendServerEvent(input: {
  eventName: meta.MetaEventName;
  eventId: string;
  user?: { email?: string | null; phone?: string | null; firstName?: string | null; lastName?: string | null };
  customData?: meta.MetaCustomData;
  sourceUrl?: string;
}): Promise<void> {
  if (!meta.isConversionsApiConfigured()) return;

  try {
    const [headerList, cookieStore] = await Promise.all([headers(), cookies()]);

    const result = await meta.sendConversionEvent({
      eventName: input.eventName,
      eventId: input.eventId,
      eventSourceUrl: input.sourceUrl,
      customData: input.customData,
      user: {
        ...input.user,
        fbp: cookieStore.get('_fbp')?.value ?? null,
        fbc: cookieStore.get('_fbc')?.value ?? null,
        clientIpAddress:
          headerList.get('cf-connecting-ip') ??
          headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          null,
        clientUserAgent: headerList.get('user-agent'),
      },
    });

    if (!result.sent && result.reason !== 'meta_not_configured') {
      console.warn('[meta] Evento no enviado:', result.reason);
    }
  } catch (error) {
    console.warn('[meta] Error enviando evento a la Conversions API:', error);
  }
}

export const createEventId = meta.createEventId;
