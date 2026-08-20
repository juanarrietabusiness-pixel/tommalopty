'use client';

import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@nebula/db';

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
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
