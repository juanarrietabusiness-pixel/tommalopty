import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoMark } from '../components/icons';

export interface AdminNavItem {
  label: string;
  href: string;
  icon?: ReactNode;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

export interface AdminSidebarProps {
  brandName: string;
  groups: AdminNavGroup[];
  currentPath: string;
  user: { name: string; role: string };
}

/** Marca activo el enlace más específico que coincida con la ruta actual. */
function isActive(currentPath: string, href: string): boolean {
  if (href === '/') return currentPath === '/';
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function AdminSidebar({ brandName, groups, currentPath, user }: AdminSidebarProps) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <LogoMark />
        <div>
          {brandName}
          <small>Panel</small>
        </div>
      </div>

      <nav className="admin-nav" aria-label="Navegación del panel">
        {groups.map((group) => (
          <div className="admin-nav-group" key={group.title}>
            <h4>{group.title}</h4>
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(currentPath, item.href) ? 'page' : undefined}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <strong>{user.name}</strong>
        <span>{user.role}</span>
      </div>
    </aside>
  );
}
