'use client';

import { useActionState, useState } from 'react';
import { slugify } from '@nebula/ui';
import {
  MAX_MENU_ITEMS,
  MAX_MENU_LABEL_LENGTH,
  MENU_LOCATION_LABELS,
  type MenuItem,
  type MenuLocation,
} from '@nebula/domain';
import { savePage, saveBanner, saveMenu, deleteBanner } from '@/lib/actions/cms';
import { IDLE } from '@/lib/actions/result';
import { FieldError, FormFeedback, SubmitButton, propsDeCampo } from './form';
import { BotonDestructivo } from './boton-destructivo';
import { ImageUpload } from './image-upload';

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
        {initial.isActive ? (
          <span className="tag tag-success">Activo</span>
        ) : (
          <span className="tag">Oculto</span>
        )}
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
        <input
          id={`subtitle-${initial.placement}`}
          name="subtitle"
          defaultValue={initial.subtitle}
        />
      </div>

      {initial.placement !== 'announcement_bar' ? (
        <div className="field-row">
          <div className="field">
            <label htmlFor={`ctaLabel-${initial.placement}`}>Texto del botón</label>
            <input
              id={`ctaLabel-${initial.placement}`}
              name="ctaLabel"
              defaultValue={initial.ctaLabel}
            />
          </div>
          <div className="field">
            <label htmlFor={`ctaUrl-${initial.placement}`}>Enlace del botón</label>
            <input
              id={`ctaUrl-${initial.placement}`}
              name="ctaUrl"
              defaultValue={initial.ctaUrl}
              placeholder="/tienda"
            />
          </div>
        </div>
      ) : null}

      {initial.placement === 'hero' ? (
        <ImageUpload
          name="mediaUrl"
          kind="cms"
          initialUrl={initial.mediaUrl}
          label="Imagen de campaña"
          hint="Sin imagen se usa el degradado del diseño original."
        />
      ) : null}

      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontSize: '0.85rem',
          marginBottom: 16,
        }}
      >
        <input type="checkbox" name="isActive" defaultChecked={initial.isActive} />
        Mostrar en la tienda
      </label>

      <div className="form-actions">
        <SubmitButton />
        {initial.id ? <BorrarBanner bannerId={initial.id} zona={initial.placement} /> : null}
      </div>
    </form>
  );
}

/**
 * Borra el banner de una zona, y con él su imagen del almacenamiento.
 *
 * Es distinto de desmarcar «Mostrar en la tienda»: eso lo oculta y conserva el
 * texto y la imagen para volver a encenderlo. Esto lo borra, y desde el PR #43
 * la imagen se va también de R2. Por eso pregunta y aquello no.
 */
function BorrarBanner({ bannerId, zona }: { bannerId: string; zona: BannerValues['placement'] }) {
  return (
    <BotonDestructivo
      etiqueta={`Borrar el banner de ${PLACEMENT_LABELS[zona]}`}
      confirmacion={`¿Borrar el banner de «${PLACEMENT_LABELS[zona]}»? Se elimina su imagen del almacenamiento y no se puede deshacer. Para ocultarlo sin perderlo, desmarca «Mostrar en la tienda».`}
      alConfirmar={() => deleteBanner(bannerId)}
    >
      Borrar
    </BotonDestructivo>
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
          {...propsDeCampo(state, 'title')}
        />
        <FieldError state={state} field="title" />
      </div>

      <div className="field">
        <label htmlFor="slug">Slug</label>
        <input
          id="slug"
          name="slug"
          defaultValue={values.slug}
          required
          {...propsDeCampo(state, 'slug')}
        />
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
          {...propsDeCampo(state, 'body')}
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

export interface MenuValues {
  location: MenuLocation;
  items: MenuItem[];
}

/**
 * Editor de una zona de navegación.
 *
 * Las filas se mandan como `label`/`url` repetidos y el servidor las empareja
 * por posición, así que reordenar es mover la fila: no hay identificadores que
 * mantener para algo que en la base de datos es un único JSON.
 */
export function MenuForm({ initial }: { initial: MenuValues }) {
  const [state, formAction] = useActionState(saveMenu, IDLE);
  const [rows, setRows] = useState<MenuItem[]>(
    initial.items.length > 0 ? initial.items : [{ label: '', url: '' }],
  );

  const zona = initial.location;

  function update(index: number, field: keyof MenuItem, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;

    setRows((current) => {
      const next = [...current];
      const movida = next[index];
      const desplazada = next[target];
      if (!movida || !desplazada) return current;

      next[index] = desplazada;
      next[target] = movida;
      return next;
    });
  }

  return (
    <form action={formAction} className="card">
      <div className="card-head">
        <h3>{MENU_LOCATION_LABELS[zona]}</h3>
        <span className="tag">
          {rows.length} de {MAX_MENU_ITEMS}
        </span>
      </div>

      <FormFeedback state={state} />

      <input type="hidden" name="location" value={zona} />

      <ul className="menu-rows">
        {rows.map((row, index) => (
          <li key={`${zona}-${index}`} className="menu-row">
            <div className="field">
              <label htmlFor={`label-${zona}-${index}`}>Texto</label>
              <input
                id={`label-${zona}-${index}`}
                name="label"
                value={row.label}
                maxLength={MAX_MENU_LABEL_LENGTH}
                onChange={(event) => update(index, 'label', event.target.value)}
                placeholder="Tienda"
              />
              <FieldError state={state} field={`label-${index}`} />
            </div>

            <div className="field">
              <label htmlFor={`url-${zona}-${index}`}>Destino</label>
              <input
                id={`url-${zona}-${index}`}
                name="url"
                value={row.url}
                onChange={(event) => update(index, 'url', event.target.value)}
                placeholder="/tienda"
              />
              <FieldError state={state} field={`url-${index}`} />
            </div>

            <div className="menu-row-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Subir ${row.label || `el enlace ${index + 1}`}`}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => move(index, 1)}
                disabled={index === rows.length - 1}
                aria-label={`Bajar ${row.label || `el enlace ${index + 1}`}`}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                aria-label={`Quitar ${row.label || `el enlace ${index + 1}`}`}
              >
                Quitar
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="menu-foot">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setRows((current) => [...current, { label: '', url: '' }])}
          disabled={rows.length >= MAX_MENU_ITEMS}
        >
          Añadir enlace
        </button>
        <SubmitButton />
      </div>

      <span className="field-hint">
        Una ruta interna empieza por «/» (por ejemplo <code>/tienda</code>). También valen
        direcciones http(s), <code>mailto:</code> y <code>tel:</code>.
      </span>
    </form>
  );
}
