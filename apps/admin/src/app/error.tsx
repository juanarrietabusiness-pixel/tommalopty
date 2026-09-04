'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Pantalla de error del panel.
 *
 * Aparece cuando una pantalla falla al renderizar, que aquí casi siempre
 * significa que Supabase no respondió. Las 25 páginas del panel son
 * `force-dynamic` y consultan la base antes de pintar nada, así que un corte de
 * red las tumba a todas.
 *
 * No usa `PanelPage`: un `error.tsx` tiene que ser componente de cliente, y
 * `PanelPage` es asíncrono porque comprueba la sesión contra la base — la misma
 * base que acaba de fallar. Reutilizarlo aquí sería pedirle a la pantalla de
 * error que dependa justo de lo que se rompió. Por eso esta se pinta sola.
 *
 * Y por eso mismo no dice «Volver al resumen» sino que ofrece reintentar
 * primero: si la base sigue caída, ir a otra pantalla lleva a este mismo sitio.
 */
export default function ErrorDelPanel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[panel] Error de renderizado:', error);
  }, [error]);

  return (
    <div className="admin-error">
      <h1>No pudimos cargar esta pantalla</h1>
      <p>
        Casi siempre es que la base de datos no respondió a tiempo. No se ha perdido nada de lo que
        tuvieras guardado.
      </p>

      <div className="admin-error-actions">
        <button type="button" className="btn btn-dark btn-sm" onClick={reset}>
          Reintentar
        </button>
        <Link href="/" className="btn btn-outline btn-sm">
          Ir al resumen
        </Link>
      </div>

      {error.digest ? (
        <p className="field-hint">
          Referencia del error: <code>{error.digest}</code>
        </p>
      ) : null}
    </div>
  );
}
