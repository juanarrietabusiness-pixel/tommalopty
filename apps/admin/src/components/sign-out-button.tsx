'use client';

import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@nebula/db';

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await createSupabaseBrowserClient().auth.signOut();
    router.push('/entrar');
    router.refresh();
  }

  return (
    <button type="button" className="btn btn-outline btn-sm" onClick={handleSignOut}>
      Salir
    </button>
  );
}
