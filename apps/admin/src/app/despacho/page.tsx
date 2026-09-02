import type { Metadata } from 'next';
import { PanelPage } from '@/components/panel-page';
import { DespachoPanel } from '@/components/despacho-panel';
import { requireAdmin } from '@/lib/auth';
import { cargarDespacho } from '@/lib/panel-data';

export const metadata: Metadata = { title: 'Despacho' };

export const dynamic = 'force-dynamic';

export default async function DespachoPage() {
  await requireAdmin();

  const { envios, motorizados, zonas, enPausaOInactivos } = await cargarDespacho();

  return (
    <PanelPage title="Despacho" description="Qué hay que mover ahora, y a quién conviene dárselo.">
      <DespachoPanel
        envios={envios}
        motorizados={motorizados}
        zonas={zonas}
        enPausaOInactivos={enPausaOInactivos}
      />
    </PanelPage>
  );
}
