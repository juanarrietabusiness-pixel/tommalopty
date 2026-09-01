import type { Metadata } from 'next';
import { listDeliveryZones } from '@nebula/db';
import { PanelPage } from '@/components/panel-page';
import { ReglaDespachoForm } from '@/components/regla-despacho-form';
import { ZoneDeleteButton, ZoneForm, type ZonaEditable } from '@/components/zone-form';
import { requireAdmin } from '@/lib/auth';
import { cargarReglaDeDespacho } from '@/lib/panel-data';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Reparto y despacho' };

export const dynamic = 'force-dynamic';

async function cargarZonas(): Promise<ZonaEditable[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await getSupabaseServerClient();

  // `soloActivas: false` a propósito: el panel tiene que ver también las
  // apagadas, que es justo lo que hay que poder volver a encender.
  const zonas = await listDeliveryZones(supabase, { soloActivas: false });

  const { data } = await supabase
    .from('delivery_zones')
    .select('id, description, is_active, position');

  const extra = new Map((data ?? []).map((fila) => [fila.id, fila]));

  return zonas.map((zona) => ({
    ...zona,
    description: extra.get(zona.id)?.description ?? null,
    isActive: extra.get(zona.id)?.is_active ?? true,
    position: extra.get(zona.id)?.position ?? 0,
  }));
}

export default async function ZonasPage() {
  const sesion = await requireAdmin();
  const [zonas, regla] = await Promise.all([cargarZonas(), cargarReglaDeDespacho()]);

  return (
    <PanelPage
      title="Reparto y despacho"
      description="Cuándo puede salir un pedido con saldo, y hasta dónde llega el reparto propio."
    >
      {/*
        La regla va primero: decide si un pedido puede salir, y eso manda sobre
        cualquier zona. De nada sirve tener bien dibujada el área si el pedido
        no puede moverse todavía.
      */}
      <section className="card">
        <div className="card-head">
          <h2>Cuándo se despacha un pedido con saldo</h2>
        </div>
        <ReglaDespachoForm regla={regla} puedeEditar={sesion.role === 'superadmin'} />
      </section>

      <h2 className="seccion-titulo">Zonas de reparto</h2>
      <div className="notice notice-info">
        El área se dibuja tocando el mapa. Lo que decide si una dirección entra en una zona es la
        coordenada del pedido, no el texto: por eso el checkout pide marcar el punto.
      </div>

      {zonas.length === 0 ? (
        <p className="field-hint">
          Todavía no hay ninguna zona. Sin zonas el checkout no avisa de cobertura y todos los
          pedidos usan el método de envío normal.
        </p>
      ) : (
        zonas.map((zona) => (
          <section key={zona.id} style={{ marginBottom: 28 }}>
            <ZoneForm zona={zona} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <ZoneDeleteButton id={zona.id} nombre={zona.name} />
            </div>
          </section>
        ))
      )}

      <ZoneForm />
    </PanelPage>
  );
}
