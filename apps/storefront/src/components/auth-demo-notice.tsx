import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * Sin base de datos, el alta y el acceso no pueden funcionar: pulsar el botón
 * daría un error de conexión sin explicación. Mejor decirlo antes y enseñar
 * dónde sí se puede mirar.
 */
export function AuthDemoNotice() {
  if (isSupabaseConfigured()) return null;

  return (
    <div className="notice notice-info" style={{ marginBottom: 24 }}>
      <strong>Recorrido de demostración.</strong> El alta y el acceso de clientes necesitan la base
      de datos conectada, así que este formulario todavía no crea cuentas. Mientras tanto,{' '}
      <Link href="/cuenta">el área de cliente</Link> se puede recorrer con datos de ejemplo.
    </div>
  );
}
