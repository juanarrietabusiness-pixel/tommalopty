'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminShell, type AdminNavGroup } from '@nebula/ui/admin';

/**
 * Envoltorio de cliente: solo existe para conocer la ruta activa y marcar el
 * enlace correspondiente en la barra lateral.
 */
export function PanelShell({
  brandName,
  navGroups,
  user,
  title,
  description,
  actions,
  demoNotice,
  children,
}: {
  brandName: string;
  navGroups: AdminNavGroup[];
  user: { name: string; role: string };
  title: string;
  description?: string;
  actions?: ReactNode;
  demoNotice?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AdminShell
      brandName={brandName}
      navGroups={navGroups}
      currentPath={pathname}
      user={user}
      title={title}
      description={description}
      actions={actions}
      demoNotice={demoNotice}
    >
      {children}
    </AdminShell>
  );
}
