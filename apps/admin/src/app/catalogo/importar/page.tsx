import type { Metadata } from 'next';
import Link from 'next/link';
import { PanelPage } from '@/components/panel-page';
import { ImportarProductos } from '@/components/importar-productos';
import { requireAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: 'Importar productos' };

export const dynamic = 'force-dynamic';

export default async function ImportarPage() {
  await requireAdmin();

  return (
    <PanelPage
      title="Importar productos"
      description="Desde una hoja de cálculo. Se revisa antes de guardar: verás qué columna es cada campo y cómo quedó cada precio."
      actions={
        <Link href="/catalogo" className="btn btn-outline btn-sm">
          Volver al catálogo
        </Link>
      }
    >
      <ImportarProductos />
    </PanelPage>
  );
}
