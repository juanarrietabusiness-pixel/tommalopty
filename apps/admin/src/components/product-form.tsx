'use client';

import { useActionState } from 'react';
import { slugify } from '@nebula/ui';
import { createProduct, updateProduct } from '@/lib/actions/products';
import { IDLE, type ActionResult } from '@/lib/actions/result';
import { FieldError, FormFeedback, SubmitButton, propsDeCampo } from './form';

export interface ProductFormValues {
  id?: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  brand: string;
  status: 'draft' | 'active' | 'archived';
  isFeatured: boolean;
  tags: string;
  price: number;
  compareAtPrice: number | null;
  sku: string;
  quantity: number;
  seoTitle: string;
  seoDescription: string;
}

const EMPTY: ProductFormValues = {
  title: '',
  slug: '',
  subtitle: '',
  description: '',
  brand: '',
  status: 'draft',
  isFeatured: false,
  tags: '',
  price: 0,
  compareAtPrice: null,
  sku: '',
  quantity: 0,
  seoTitle: '',
  seoDescription: '',
};

export function ProductForm({ initial }: { initial?: ProductFormValues }) {
  const values = initial ?? EMPTY;
  const isEdit = Boolean(values.id);

  const action = isEdit
    ? updateProduct.bind(null, values.id as string)
    : (createProduct as (state: ActionResult, formData: FormData) => Promise<ActionResult>);

  const [state, formAction] = useActionState(action, IDLE);

  /** Autocompleta el slug al escribir el título, solo en productos nuevos. */
  function handleTitleBlur(event: React.FocusEvent<HTMLInputElement>) {
    if (isEdit) return;
    const form = event.currentTarget.form;
    const slugInput = form?.elements.namedItem('slug') as HTMLInputElement | null;
    if (slugInput && !slugInput.value) slugInput.value = slugify(event.currentTarget.value);
  }

  return (
    <form action={formAction}>
      <FormFeedback state={state} />

      <div className="grid-sidebar">
        <div>
          <section className="card">
            <div className="card-head">
              <h2>Información</h2>
            </div>

            <div className="field">
              <label htmlFor="title">Título</label>
              <input
                id="title"
                name="title"
                defaultValue={values.title}
                onBlur={handleTitleBlur}
                required
                {...propsDeCampo(state, 'title')}
              />
              <FieldError state={state} field="title" />
            </div>

            <div className="field">
              <label htmlFor="slug">Slug (URL)</label>
              <input
                id="slug"
                name="slug"
                defaultValue={values.slug}
                required
                {...propsDeCampo(state, 'slug')}
              />
              <span className="field-hint">La ficha será /producto/&lt;slug&gt;</span>
              <FieldError state={state} field="slug" />
            </div>

            <div className="field">
              <label htmlFor="subtitle">Subtítulo</label>
              <input id="subtitle" name="subtitle" defaultValue={values.subtitle} />
            </div>

            <div className="field">
              <label htmlFor="description">Descripción</label>
              <textarea id="description" name="description" defaultValue={values.description} />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="brand">Marca</label>
                <input id="brand" name="brand" defaultValue={values.brand} />
              </div>
              <div className="field">
                <label htmlFor="tags">Etiquetas (separadas por comas)</label>
                <input id="tags" name="tags" defaultValue={values.tags} />
              </div>
            </div>
          </section>

          {/* Solo al dar de alta: la primera variante hay que crearla con algo.
              Al editar, precio, SKU y stock los gobierna la sección de
              Variantes, que es la única que sabe que puede haber más de una. */}
          {!isEdit ? (
            <section className="card">
              <div className="card-head">
                <h2>Precio e inventario</h2>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="price">Precio (USD)</label>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={values.price}
                    required
                    {...propsDeCampo(state, 'price')}
                  />
                  <FieldError state={state} field="price" />
                </div>
                <div className="field">
                  <label htmlFor="compareAtPrice">Precio antes de oferta</label>
                  <input
                    id="compareAtPrice"
                    name="compareAtPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={values.compareAtPrice ?? ''}
                  />
                  <span className="field-hint">Déjalo vacío si no está en oferta.</span>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="sku">SKU</label>
                  <input id="sku" name="sku" defaultValue={values.sku} />
                </div>
                <div className="field">
                  <label htmlFor="quantity">Stock</label>
                  <input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min="0"
                    defaultValue={values.quantity}
                    {...propsDeCampo(state, 'quantity')}
                  />
                  <FieldError state={state} field="quantity" />
                </div>
              </div>
            </section>
          ) : null}

          <section className="card">
            <div className="card-head">
              <h2>SEO</h2>
            </div>
            <div className="field">
              <label htmlFor="seoTitle">Título SEO</label>
              <input id="seoTitle" name="seoTitle" defaultValue={values.seoTitle} />
            </div>
            <div className="field">
              <label htmlFor="seoDescription">Descripción SEO</label>
              <textarea
                id="seoDescription"
                name="seoDescription"
                defaultValue={values.seoDescription}
              />
            </div>
          </section>
        </div>

        <aside className="card">
          <div className="card-head">
            <h3>Publicación</h3>
          </div>

          <div className="field">
            <label htmlFor="status">Estado</label>
            <select id="status" name="status" defaultValue={values.status}>
              <option value="draft">Borrador</option>
              <option value="active">Activo (visible en la tienda)</option>
              <option value="archived">Archivado</option>
            </select>
          </div>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem' }}>
            <input type="checkbox" name="isFeatured" defaultChecked={values.isFeatured} />
            Destacar en portada
          </label>

          <div className="form-actions" style={{ marginTop: 20 }}>
            <SubmitButton>{isEdit ? 'Guardar cambios' : 'Crear producto'}</SubmitButton>
          </div>
        </aside>
      </div>
    </form>
  );
}
