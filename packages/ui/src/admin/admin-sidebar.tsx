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

/** ¿Cubre este enlace la ruta actual? */
function cubre(currentPath: string, href: string): boolean {
  if (href === '/') return currentPath === '/';
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

/**
 * El enlace más específico de todo el menú que cubre la ruta actual.
 *
 * Hacía falta mirar el menú entero y no cada enlace por su cuenta. Con la
 * comprobación aislada, `/catalogo/categorias` la pasaban dos: «Productos»
 * (`/catalogo`) y «Categorías`, y el panel encendía los dos a la vez. El
 * comentario de antes ya prometía «el más específico»; ahora se cumple.
 */
function enlaceActivo(groups: AdminNavGroup[], currentPath: string): string | null {
  let mejor: string | null = null;

  for (const group of groups) {
    for (const item of group.items) {
      if (!cubre(currentPath, item.href)) continue;
      if (mejor === null || item.href.length > mejor.length) mejor = item.href;
    }
  }

  return mejor;
}

export function AdminSidebar({ brandName, groups, currentPath, user }: AdminSidebarProps) {
  const activo = enlaceActivo(groups, currentPath);

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
                  <Link href={item.href} aria-current={item.href === activo ? 'page' : undefined}>
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
