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
