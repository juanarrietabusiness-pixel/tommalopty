'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Pantalla de error de la tienda.
 *
 * Aparece cuando una página falla al renderizar — típicamente porque la base de
 * datos no responde. Dice la verdad y ofrece una salida, en lugar de mostrar
 * una pantalla en blanco o, peor, datos inventados.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[storefront] Error de renderizado:', error);
  }, [error]);

  return (
    <div className="container section">
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
        <h1 className="page-title">Algo se rompió de nuestro lado</h1>
        <p className="page-subtitle">
          No es culpa tuya. Estamos al tanto y trabajando en ello. Prueba de nuevo en un momento.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-dark btn-sm" onClick={reset}>
            Reintentar
          </button>
          <Link href="/" className="btn btn-outline btn-sm">
            Volver al inicio
          </Link>
        </div>

        {error.digest ? (
          <p className="field-hint" style={{ marginTop: 24 }}>
            Referencia del error: <code>{error.digest}</code>
          </p>
        ) : null}
      </div>
    </div>
  );
}
