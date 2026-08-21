import type { ReactNode } from 'react';
import { AdminSidebar, type AdminNavGroup } from './admin-sidebar';

export interface AdminShellProps {
  brandName: string;
  navGroups: AdminNavGroup[];
  currentPath: string;
  user: { name: string; role: string };
  title: string;
  description?: string;
  actions?: ReactNode;
  /**
   * Franja permanente de "esto es un recorrido de demostración".
   *
   * Va en el armazón y no en cada pantalla porque tiene que salir en todas sin
   * excepción: un panel con cifras inventadas que no se anuncia como tal es
   * exactamente cómo alguien acaba tomando una decisión sobre datos que no
   * existen.
   */
  demoNotice?: ReactNode;
  children: ReactNode;
}

export function AdminShell({
  brandName,
  navGroups,
  currentPath,
  user,
  title,
  description,
  actions,
  demoNotice,
  children,
}: AdminShellProps) {
  return (
    <div className="admin-shell">
      <AdminSidebar
        brandName={brandName}
        groups={navGroups}
        currentPath={currentPath}
        user={user}
      />
      <div className="admin-main">
        {demoNotice ? (
          <div className="admin-demo-banner" role="status">
            {demoNotice}
          </div>
        ) : null}
        <header className="admin-topbar">
          <h1>{title}</h1>
          {actions ? <div className="admin-topbar-actions">{actions}</div> : null}
        </header>
        <main className="admin-content">
          {description ? (
            <div className="admin-page-head">
              <p>{description}</p>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
