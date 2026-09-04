import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
import { SignOutButton } from '@/components/sign-out-button';

/**
 * Favoritos no está en esta lista a propósito (#52).
 *
 * La pantalla existe y lee `wishlist_items`, pero **nadie escribe nunca en esa
 * tabla**: no hay botón de guardar en ninguna ficha de producto. Enlazada, solo
 * podía decir «Todavía no has guardado productos» para siempre, y quien entraba
 * concluía —con razón— que algo estaba roto.
 *
 * Se esconde en vez de borrarse: la pantalla y su consulta funcionan, y el día
 * que exista el botón de guardar basta con devolver esta línea. Una pantalla
 * que miente es peor que una que todavía no está.
 */
const ACCOUNT_LINKS = [
  { label: 'Resumen', href: '/cuenta' },
  { label: 'Mis pedidos', href: '/cuenta/pedidos' },
  { label: 'Direcciones', href: '/cuenta/direcciones' },
  { label: 'Mis datos', href: '/cuenta/datos' },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // En modo demostración se pinta el mismo armazón que con base de datos —la
  // navegación lateral y las cuatro pantallas— con datos de ejemplo. Antes esto
  // devolvía una sola frase técnica y el área de cliente entera, que es la
  // mitad de lo que se le enseña a quien va a comprar, quedaba en blanco.
  if (!isSupabaseConfigured()) {
    return (
      <div className="container">
        <div className="notice notice-info" style={{ marginBottom: 24 }}>
          <strong>Recorrido de demostración.</strong> El área de cliente se muestra con pedidos, y
          direcciones de ejemplo, sin base de datos ni inicio de sesión. Con Supabase conectado,
          cada persona ve aquí sus propios datos.
        </div>
        <div className="account-layout">
          <aside>
            <nav className="account-nav" aria-label="Mi cuenta">
              {ACCOUNT_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </aside>
          <div>{children}</div>
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
