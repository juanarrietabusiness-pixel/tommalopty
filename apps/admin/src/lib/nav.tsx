import {
  BoxIcon,
  ChartIcon,
  DashboardIcon,
  DocumentIcon,
  LinkIcon,
  MegaphoneIcon,
  ReceiptIcon,
  SettingsIcon,
  TagIcon,
  UsersIcon,
} from '@nebula/ui';
import type { AdminNavGroup } from '@nebula/ui/admin';
import type { Enums } from '@nebula/db';

/**
 * Navegación del panel.
 * Se filtra por rol: un operador no ve las secciones que no puede usar.
 */
export function getNavGroups(role: Enums<'user_role'>): AdminNavGroup[] {
  const groups: AdminNavGroup[] = [
    {
      title: 'General',
      items: [{ label: 'Dashboard', href: '/', icon: <DashboardIcon /> }],
    },
    {
      title: 'Ventas',
      items: [
        { label: 'Pedidos', href: '/pedidos', icon: <ReceiptIcon /> },
        { label: 'Clientes / CRM', href: '/clientes', icon: <UsersIcon /> },
        { label: 'Descuentos', href: '/descuentos', icon: <TagIcon /> },
      ],
    },
    {
      title: 'Catálogo',
      items: [
        { label: 'Productos', href: '/catalogo', icon: <BoxIcon /> },
        { label: 'Categorías', href: '/catalogo/categorias', icon: <TagIcon /> },
        { label: 'Inventario', href: '/catalogo/inventario', icon: <BoxIcon /> },
      ],
    },
    {
      title: 'Contenido',
      items: [
        { label: 'Banners', href: '/contenido/banners', icon: <MegaphoneIcon /> },
        { label: 'Páginas', href: '/contenido/paginas', icon: <DocumentIcon /> },
        { label: 'Menús', href: '/contenido/menus', icon: <LinkIcon /> },
      ],
    },
    {
      title: 'Análisis',
      items: [{ label: 'Reportes', href: '/reportes', icon: <ChartIcon /> }],
    },
  ];

  if (role === 'admin' || role === 'superadmin') {
    groups.push({
      title: 'Administración',
      items: [
        { label: 'Usuarios y roles', href: '/usuarios', icon: <UsersIcon /> },
        { label: 'Reparto y despacho', href: '/configuracion/zonas', icon: <BoxIcon /> },
        { label: 'Integraciones', href: '/configuracion', icon: <SettingsIcon /> },
      ],
    });
  }

  return groups;
}
