'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createSupabaseBrowserClient } from '@nebula/db';

export function AdminLoginForm() {
  const router = useRouter();
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

      router.push('/');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos iniciar sesión.');
    } finally {
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
