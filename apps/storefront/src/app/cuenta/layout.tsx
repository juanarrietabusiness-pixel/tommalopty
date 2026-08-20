import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
import { SignOutButton } from '@/components/sign-out-button';

const ACCOUNT_LINKS = [
  { label: 'Resumen', href: '/cuenta' },
  { label: 'Mis pedidos', href: '/cuenta/pedidos' },
  { label: 'Direcciones', href: '/cuenta/direcciones' },
  { label: 'Favoritos', href: '/cuenta/favoritos' },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="container section">
        <div className="notice notice-info">
          El área de cliente necesita una instancia de Supabase configurada.
        </div>
      </div>
    );
  }

  // El middleware ya redirige, pero esta comprobación evita renderizar datos
  // si alguien llega por otra vía.
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/entrar?redirect=/cuenta');

  return (
    <div className="container">
      <div className="account-layout">
        <aside>
          <nav className="account-nav" aria-label="Mi cuenta">
            {ACCOUNT_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div style={{ marginTop: 16 }}>
            <SignOutButton />
          </div>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
