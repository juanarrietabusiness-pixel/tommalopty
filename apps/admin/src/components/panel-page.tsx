import type { ReactNode } from 'react';
import { getNavGroups } from '@/lib/nav';
import { requireStaff, roleLabel } from '@/lib/auth';
import { PanelShell } from './panel-shell';
import { SignOutButton } from './sign-out-button';

/**
 * Envoltorio común de todas las pantallas del panel: exige sesión de staff y
 * monta la barra lateral con las secciones que el rol puede ver.
 */
export async function PanelPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const session = await requireStaff();
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Nébula Store';

  return (
    <PanelShell
      brandName={brandName}
      navGroups={getNavGroups(session.role)}
      user={{ name: session.fullName, role: roleLabel(session.role) }}
      title={title}
      description={description}
      actions={
        <>
          {actions}
          <SignOutButton />
        </>
      }
    >
      {children}
    </PanelShell>
  );
}
