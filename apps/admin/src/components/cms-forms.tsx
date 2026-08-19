'use client';

import { useActionState } from 'react';
import { slugify } from '@nebula/ui';
import { savePage, saveBanner } from '@/lib/actions/cms';
import { IDLE } from '@/lib/actions/result';
import { FieldError, FormFeedback, SubmitButton } from './form';

export interface BannerValues {
  id?: string;
  placement: 'announcement_bar' | 'hero' | 'cta_band';
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaUrl: string;
  mediaUrl: string;
  isActive: boolean;
}

const PLACEMENT_LABELS: Record<BannerValues['placement'], string> = {
  announcement_bar: 'Barra de anuncios (arriba del todo)',
  hero: 'Hero de portada',
  cta_band: 'Banda de newsletter',
};

export function BannerForm({ initial }: { initial: BannerValues }) {
  const [state, formAction] = useActionState(saveBanner, IDLE);

  return (
    <form action={formAction} className="card">
      <div className="card-head">
        <h3>{PLACEMENT_LABELS[initial.placement]}</h3>
        {initial.isActive ? <span className="tag tag-success">Activo</span> : <span className="tag">Oculto</span>}
      </div>

      <FormFeedback state={state} />

      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="placement" value={initial.placement} />

      <div className="field-row">
        <div className="field">
          <label htmlFor={`eyebrow-${initial.placement}`}>Antetítulo</label>
          <input
            id={`eyebrow-${initial.placement}`}
            name="eyebrow"
            defaultValue={initial.eyebrow}
            placeholder="Nueva colección"
          />
        </div>
        <div className="field">
          <label htmlFor={`title-${initial.placement}`}>Título</label>
          <input id={`title-${initial.placement}`} name="title" defaultValue={initial.title} />
        </div>
      </div>

      <div className="field">
        <label htmlFor={`subtitle-${initial.placement}`}>Subtítulo</label>
        <input id={`subtitle-${initial.placement}`} name="subtitle" defaultValue={initial.subtitle} />
      </div>

      {initial.placement !== 'announcement_bar' ? (
        <div className="field-row">
          <div className="field">
            <label htmlFor={`ctaLabel-${initial.placement}`}>Texto del botón</label>
            <input id={`ctaLabel-${initial.placement}`} name="ctaLabel" defaultValue={initial.ctaLabel} />
          </div>
          <div className="field">
            <label htmlFor={`ctaUrl-${initial.placement}`}>Enlace del botón</label>
            <input id={`ctaUrl-${initial.placement}`} name="ctaUrl" defaultValue={initial.ctaUrl} placeholder="/tienda" />
          </div>
        </div>
      ) : null}

      {initial.placement === 'hero' ? (
        <div className="field">
          <label htmlFor="mediaUrl">Imagen de campaña (URL)</label>
          <input id="mediaUrl" name="mediaUrl" defaultValue={initial.mediaUrl} />
          <span className="field-hint">
            Sin imagen se usa el degradado del diseño original.
          </span>
        </div>
      ) : null}

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem', marginBottom: 16 }}>
        <input type="checkbox" name="isActive" defaultChecked={initial.isActive} />
        Mostrar en la tienda
      </label>

      <SubmitButton />
    </form>
  );
}

export interface PageValues {
  id?: string;
  title: string;
  slug: string;
  body: string;
  status: 'draft' | 'published' | 'archived';
  seoTitle: string;
  seoDescription: string;
}

export function PageForm({ initial }: { initial?: PageValues }) {
  const values: PageValues = initial ?? {
    title: '',
    slug: '',
    body: '',
    status: 'draft',
    seoTitle: '',
    seoDescription: '',
  };

  const [state, formAction] = useActionState(savePage, IDLE);

  return (
    <form action={formAction} className="card">
      <div className="card-head">
        <h3>{values.id ? 'Editar página' : 'Nueva página'}</h3>
      </div>

      <FormFeedback state={state} />

      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div className="field">
        <label htmlFor="title">Título</label>
        <input
          id="title"
          name="title"
          defaultValue={values.title}
          required
          onBlur={(event) => {
            if (values.id) return;
            const slugInput = event.currentTarget.form?.elements.namedItem(
              'slug',
            ) as HTMLInputElement | null;
            if (slugInput && !slugInput.value) slugInput.value = slugify(event.currentTarget.value);
          }}
        />
        <FieldError state={state} field="title" />
      </div>

      <div className="field">
        <label htmlFor="slug">Slug</label>
        <input id="slug" name="slug" defaultValue={values.slug} required />
        <span className="field-hint">La página estará en /p/&lt;slug&gt;</span>
        <FieldError state={state} field="slug" />
      </div>

      <div className="field">
        <label htmlFor="body">Contenido</label>
        <textarea
          id="body"
          name="body"
          defaultValue={values.body}
          required
          style={{ minHeight: 220 }}
        />
        <span className="field-hint">
          Cada párrafo (separado por una línea en blanco) se guarda como un bloque.
        </span>
        <FieldError state={state} field="body" />
      </div>

      <div className="field">
        <label htmlFor="status">Estado</label>
        <select id="status" name="status" defaultValue={values.status}>
          <option value="draft">Borrador</option>
          <option value="published">Publicada</option>
          <option value="archived">Archivada</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="seoTitle">Título SEO</label>
        <input id="seoTitle" name="seoTitle" defaultValue={values.seoTitle} />
      </div>

      <div className="field">
        <label htmlFor="seoDescription">Descripción SEO</label>
        <textarea id="seoDescription" name="seoDescription" defaultValue={values.seoDescription} />
      </div>

      <SubmitButton />
    </form>
  );
}
