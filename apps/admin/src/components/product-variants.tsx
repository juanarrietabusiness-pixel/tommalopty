'use client';

import { useActionState, useState, useTransition } from 'react';
import { MAX_VARIANT_TITLE_LENGTH } from '@nebula/domain';
import {
  createVariant,
  deleteVariant,
  setDefaultVariant,
  updateVariant,
} from '@/lib/actions/products';
import { IDLE, type ActionResult } from '@/lib/actions/result';
import type { VarianteEditable } from '@/lib/panel-data';
import { FieldError, FormFeedback, SubmitButton, propsDeCampo } from './form';
import { BotonDestructivo } from './boton-destructivo';

/**
 * Variantes de un producto: alta, edición, cuál es la de por defecto y borrado.
 *
 * Antes de esta pantalla el panel solo tocaba la variante por defecto. La tienda
 * ya sabía pintar el selector cuando había más de una, así que talla y color
 * eran vendibles en teoría y no en la práctica: no había forma de crear la
 * segunda sin entrar a la base de datos.
 */
export function ProductVariants({
  productId,
  variants,
}: {
  productId: string;
  variants: VarianteEditable[];
}) {
  const [state, setState] = useState<ActionResult>(IDLE);
  const [pendiente, startTransition] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);

  function ejecutar(accion: () => Promise<ActionResult>) {
    startTransition(async () => {
      setState(await accion());
    });
  }

  return (
    <section className="card">
      <div className="card-head">
        <h3>Variantes</h3>
        <span className="tag">{variants.length}</span>
      </div>

      <FormFeedback state={state} />

      {variants.length === 0 ? (
        <p className="field-hint">
          Este producto no tiene ninguna variante, así que no se puede comprar. Crea al menos una.
        </p>
      ) : (
        <ul className="variant-rows">
          {variants.map((variant) =>
            editando === variant.id ? (
              <li key={variant.id} className="variant-row is-editing">
                <VariantForm
                  productId={productId}
                  variant={variant}
                  onDone={() => setEditando(null)}
                />
              </li>
            ) : (
              <li key={variant.id} className="variant-row">
                <div className="variant-row-main">
                  <strong>{variant.title}</strong>
                  <div className="variant-row-tags">
                    {variant.isDefault ? (
                      <span className="tag tag-success">Por defecto</span>
                    ) : null}
                    {!variant.isActive ? <span className="tag">Oculta</span> : null}
                    {variant.sku ? <span className="tag">{variant.sku}</span> : null}
                  </div>
                </div>

                <div className="variant-row-numbers">
                  <span className="variant-price">${variant.price.toFixed(2)}</span>
                  {variant.compareAtPrice && variant.compareAtPrice > variant.price ? (
                    <span className="variant-compare">${variant.compareAtPrice.toFixed(2)}</span>
                  ) : null}
                  <span className="field-hint">
                    {variant.quantity} en stock
                    {variant.reservedQuantity > 0
                      ? ` · ${variant.reservedQuantity} reservadas`
                      : null}
                  </span>
                </div>

                <div className="variant-row-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={pendiente}
                    onClick={() => setEditando(variant.id)}
                  >
                    Editar
                  </button>
                  {!variant.isDefault ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={pendiente}
                      onClick={() => ejecutar(() => setDefaultVariant(productId, variant.id))}
                    >
                      Por defecto
                    </button>
                  ) : null}
                  {variants.length <= 1 ? (
                    <span
                      className="btn btn-outline btn-sm"
                      aria-disabled="true"
                      title="Es la única variante: archiva el producto en vez de borrarla."
                    >
                      Borrar
                    </span>
                  ) : (
                    <BotonDestructivo
                      disabled={pendiente}
                      etiqueta={`Borrar la variante ${variant.title}`}
                      confirmacion={`¿Borrar la variante «${variant.title}»? Se pierden su precio y su inventario, y no se puede deshacer.`}
                      alConfirmar={() => deleteVariant(productId, variant.id)}
                    >
                      Borrar
                    </BotonDestructivo>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      <details className="variant-new">
        <summary>Añadir variante</summary>
        <VariantForm productId={productId} />
      </details>
    </section>
  );
}

/**
 * Formulario de una variante, para alta y edición.
 *
 * `createVariant` y `updateVariant` llevan el producto (y la variante) ligados
 * antes de pasar por `useActionState`, que solo entrega estado anterior y
 * `FormData`.
 */
function VariantForm({
  productId,
  variant,
  onDone,
}: {
  productId: string;
  variant?: VarianteEditable;
  onDone?: () => void;
}) {
  const accion = variant
    ? updateVariant.bind(null, productId, variant.id)
    : createVariant.bind(null, productId);

  const [state, formAction] = useActionState(accion, IDLE);
  const id = variant?.id ?? 'nueva';

  return (
    <form action={formAction} className="variant-form">
      <FormFeedback state={state} />

      <div className="field-row">
        <div className="field">
          <label htmlFor={`title-${id}`}>Nombre</label>
          <input
            id={`title-${id}`}
            name="title"
            defaultValue={variant?.title ?? ''}
            maxLength={MAX_VARIANT_TITLE_LENGTH}
            placeholder="Talla M · Rojo"
            required
            {...propsDeCampo(state, 'title')}
          />
          <FieldError state={state} field="title" />
        </div>

        <div className="field">
          <label htmlFor={`sku-${id}`}>SKU</label>
          <input
            id={`sku-${id}`}
            name="sku"
            defaultValue={variant?.sku ?? ''}
            {...propsDeCampo(state, 'sku')}
          />
          <FieldError state={state} field="sku" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`price-${id}`}>Precio</label>
          <input
            id={`price-${id}`}
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={variant?.price ?? ''}
            required
            {...propsDeCampo(state, 'price')}
          />
          <FieldError state={state} field="price" />
        </div>

        <div className="field">
          <label htmlFor={`compareAtPrice-${id}`}>Precio tachado</label>
          <input
            id={`compareAtPrice-${id}`}
            name="compareAtPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={variant?.compareAtPrice ?? ''}
            {...propsDeCampo(state, 'compareAtPrice')}
          />
          <span className="field-hint">Déjalo vacío si no está en oferta.</span>
          <FieldError state={state} field="compareAtPrice" />
        </div>
      </div>

      {variant ? (
        <label className="variant-check">
          <input type="checkbox" name="isActive" defaultChecked={variant.isActive} />
          Visible en la tienda
        </label>
      ) : (
        <div className="field">
          <label htmlFor="quantity-nueva">Stock inicial</label>
          <input
            id="quantity-nueva"
            name="quantity"
            type="number"
            min="0"
            step="1"
            defaultValue={0}
            {...propsDeCampo(state, 'quantity')}
          />
          <span className="field-hint">Después se ajusta desde Inventario.</span>
          <FieldError state={state} field="quantity" />
        </div>
      )}

      <div className="variant-form-actions">
        <SubmitButton>{variant ? 'Guardar cambios' : 'Crear variante'}</SubmitButton>
        {onDone ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={onDone}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
