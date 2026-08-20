import { PanelPage } from '@/components/panel-page';
import { IntegrationForm } from '@/components/settings-forms';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Comprueba en servidor si el entorno tiene cargadas las credenciales de cada
 * integración. Nunca se devuelve el valor: solo si existe o no.
 */
const CREDENTIAL_ENV: Record<string, string[]> = {
  paypal: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
  wompi: ['WOMPI_PUBLIC_KEY', 'WOMPI_PRIVATE_KEY'],
  paguelofacil: ['PAGUELOFACIL_CCLW'],
  yappy: ['YAPPY_MERCHANT_ID', 'YAPPY_SECRET_KEY'],
  meta_pixel: ['NEXT_PUBLIC_META_PIXEL_ID', 'META_CONVERSIONS_ACCESS_TOKEN'],
  resend: ['RESEND_API_KEY'],
};

function hasCredentials(provider: string): boolean {
  const keys = CREDENTIAL_ENV[provider];
  if (!keys) return false;
  return keys.every((key) => Boolean(process.env[key]));
}

export default async function IntegrationsPage() {
  const session = await requireAdmin();
  const supabase = await getSupabaseServerClient();

  const { data: integrations } = await supabase.from('integrations').select('*').order('provider');

  return (
    <PanelPage
      title="Integraciones"
      description="Aquí solo se activa cada servicio. Las claves viven en variables de entorno del hosting, nunca en la base de datos."
    >
      <div className="notice notice-info">
        Para cargar o rotar credenciales, edita las variables de entorno del proyecto en Cloudflare
        (o el <code>.env.local</code> en desarrollo) y vuelve a desplegar. Consulta
        <code> .env.example</code> para ver los nombres exactos.
      </div>

      <div className="grid-2">
        {(integrations ?? []).map((integration) => {
          const label = (integration.config as { label?: string })?.label ?? integration.provider;

          return (
            <IntegrationForm
              key={integration.provider}
              provider={integration.provider}
              label={label}
              isEnabled={integration.is_enabled}
              environment={integration.environment}
              hasCredentials={hasCredentials(integration.provider)}
              canEdit={session.role === 'superadmin'}
            />
          );
        })}
      </div>
    </PanelPage>
  );
}
