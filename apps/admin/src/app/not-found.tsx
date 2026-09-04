import Link from 'next/link';
import { PanelPage } from '@/components/panel-page';

/**
 * El 404 del panel, dentro del panel.
 *
 * Seis pantallas de detalle llaman a `notFound()` cuando el registro ya no
 * existe —un pedido borrado, un producto que otra persona archivó—, y sin este
 * fichero caían en el 404 por defecto de Next: fondo blanco, sin menú, sin
 * vuelta atrás, en mitad de una sesión iniciada. Parecía que se había roto el
 * sitio, cuando lo único que pasaba es que la fila ya no está.
 *
 * Va envuelto en `PanelPage` a propósito: conserva el menú, así que la salida
 * está donde la persona ya sabe buscarla.
 */
export default function NoEncontrado() {
  return (
    <PanelPage
      title="Aquí no hay nada"
      description="La dirección es válida, pero lo que buscabas ya no está."
    >
      <div className="card">
        <p>
          Puede que se haya borrado, o que la dirección tenga una errata. Si llegaste desde un
          enlace guardado, es probable que apunte a algo que ya no existe.
        </p>
        <p style={{ marginTop: 16 }}>
          <Link href="/" className="btn btn-dark btn-sm">
            Ir al resumen
          </Link>
        </p>
      </div>
    </PanelPage>
  );
}
