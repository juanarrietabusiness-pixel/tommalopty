'use client';

import { createSupabaseBrowserClient } from '@nebula/db';

export function SignOutButton() {
  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    // Recarga completa: si no, la tienda sigue mostrando el estado de la sesión
    // anterior —«Mi cuenta», favoritos— hasta que alguien recargue a mano.
    // La regla de Next pide `router.push`, que es justo lo que falla aquí: tras un
    // cambio de sesión hay que descartar la caché del router, no reutilizarla.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/');
  }

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      onClick={handleSignOut}
      style={{ width: '100%' }}
    >
      Cerrar sesión
    </button>
  );
}
