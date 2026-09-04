'use client';

import { createSupabaseBrowserClient } from '@nebula/db';

export function SignOutButton() {
  async function handleSignOut() {
    await createSupabaseBrowserClient().auth.signOut();
    // Recarga completa, por lo mismo que al entrar: `router.push` serviría el
    // panel desde la caché del router y se seguiría viendo contenido de una
    // sesión que ya no existe hasta que alguien recargara a mano.
    // La regla de Next pide `router.push`, que es justo lo que falla aquí: tras un
    // cambio de sesión hay que descartar la caché del router, no reutilizarla.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/entrar');
  }

  return (
    <button type="button" className="btn btn-outline btn-sm" onClick={handleSignOut}>
      Salir
    </button>
  );
}
