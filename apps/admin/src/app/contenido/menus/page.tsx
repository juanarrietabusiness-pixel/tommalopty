import { MENU_LOCATIONS, parseMenuItems, type MenuLocation } from '@nebula/domain';
import { PanelPage } from '@/components/panel-page';
import { MenuForm } from '@/components/cms-forms';
import { cargarMenus } from '@/lib/panel-data';

export const dynamic = 'force-dynamic';

/**
 * Editor de las tres zonas de navegación.
 *
 * Antes de esta pantalla, cambiar un enlace del pie exigía entrar a la base de
 * datos y escribir SQL: `cms_menus` se cargaba por seed y no se tocaba desde
 * ningún sitio.
 */
export default async function MenusPage() {
  const menus = await cargarMenus();

  const porZona = new Map(menus.map((menu) => [menu.location, parseMenuItems(menu.items)]));

  return (
    <PanelPage
      title="Menús"
      description="Los enlaces de la cabecera y del pie. La tienda los muestra en cuanto revalida (hasta 5 minutos)."
    >
      <div className="grid-2">
        {MENU_LOCATIONS.map((location: MenuLocation) => (
          <MenuForm key={location} initial={{ location, items: porZona.get(location) ?? [] }} />
        ))}
      </div>
    </PanelPage>
  );
}
