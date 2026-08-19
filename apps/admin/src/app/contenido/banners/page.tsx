import { PanelPage } from '@/components/panel-page';
import { BannerForm, type BannerValues } from '@/components/cms-forms';
import { getSupabaseServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const PLACEMENTS: BannerValues['placement'][] = ['announcement_bar', 'hero', 'cta_band'];

/**
 * Editor de las tres zonas de contenido de la portada. Cada zona mapea 1:1 con
 * un bloque del diseño aprobado, así que la clienta edita textos sin tocar código.
 */
export default async function BannersPage() {
  const supabase = await getSupabaseServerClient();

  const { data: banners } = await supabase
    .from('cms_banners')
    .select('*')
    .in('placement', PLACEMENTS)
    .order('position');

  const byPlacement = new Map(
    (banners ?? []).map((banner) => [banner.placement as BannerValues['placement'], banner]),
  );

  return (
    <PanelPage
      title="Banners"
      description="Los cambios se publican en la tienda en cuanto se revalida la portada (hasta 5 minutos)."
    >
      <div className="grid-2">
        {PLACEMENTS.map((placement) => {
          const banner = byPlacement.get(placement);

          const initial: BannerValues = {
            id: banner?.id,
            placement,
            eyebrow: banner?.eyebrow ?? '',
            title: banner?.title ?? '',
            subtitle: banner?.subtitle ?? '',
            ctaLabel: banner?.cta_label ?? '',
            ctaUrl: banner?.cta_url ?? '',
            mediaUrl: banner?.media_url ?? '',
            isActive: banner?.is_active ?? true,
          };

          return <BannerForm key={placement} initial={initial} />;
        })}
      </div>
    </PanelPage>
  );
}
