'use client';

import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createSupabaseBrowserClient } from '@nebula/db';

export function AdminLoginForm() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'idle' | 'sending'>('idle');
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'sin_permisos'
      ? 'Tu cuenta no tiene permisos para acceder al panel.'
      : null,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: String(formData.get('email')),
        password: String(formData.get('password')),
      });

      if (signInError) throw signInError;

      // Navegación completa del documento, y no `router.push`, a propósito.
      //
      // `router.push` resuelve desde la caché del router de Next, que en este
      // momento todavía guarda lo que devolvió `/` **antes** de haber sesión:
      // el redirect a esta misma pantalla. El efecto es desconcertante — el
      // primer clic sí autentica, pero parece que no pasa nada, y hay que
      // insistir o recargar a mano con Ctrl+Shift+R, que es justo lo que
      // vacía esa caché.
      //
      // `assign` descarta la caché entera y hace que el middleware vuelva a
      // decidir con la cookie ya escrita. Cuesta una recarga, una sola vez.
      // La regla de Next pide `router.push`, que es justo lo que falla aquí: tras un
      // cambio de sesión hay que descartar la caché del router, no reutilizarla.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos iniciar sesión.');
      // Solo se rehabilita el botón si algo falló: cuando va bien, la página
      // ya se está yendo y volver a poner «Entrar» es un parpadeo confuso.
      setStatus('idle');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error ? <div className="notice notice-error">{error}</div> : null}

      <div className="field">
        <label htmlFor="email">Correo electrónico</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      <button
        type="submit"
        className="btn btn-dark"
        style={{ width: '100%' }}
        disabled={status === 'sending'}
      >
        {status === 'sending' ? 'Entrando…' : 'Entrar al panel'}
      </button>
    </form>
  );
}
