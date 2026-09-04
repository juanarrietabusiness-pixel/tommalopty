'use client';

import { useRef, useState, useTransition } from 'react';
import { storage } from '@nebula/integrations';
import {
  addProductImage,
  deleteProductImage,
  setPrimaryProductImage,
} from '@/lib/actions/products';
import type { ImagenProducto } from '@/lib/panel-data';
import type { ActionResult } from '@/lib/actions/result';
import { FormFeedback } from './form';
import { BotonDestructivo } from './boton-destructivo';

/**
 * Galería de un producto: subir, marcar la principal y borrar.
 *
 * No es un formulario con `useActionState` como el resto del panel porque cada
 * acción actúa sobre una imagen distinta y se lanza sola, sin un «Guardar» que
 * las agrupe. El estado del resultado se lleva a mano por eso.
 */
export function ProductImages({
  productId,
  images,
}: {
  productId: string;
  images: ImagenProducto[];
}) {
  const [state, setState] = useState<ActionResult>({ status: 'idle' });
  const [subiendo, setSubiendo] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const ocupado = subiendo || pendiente;

  async function subir(file: File) {
    setSubiendo(true);
    setState({ status: 'idle' });

    try {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', 'producto');

      const response = await fetch('/api/media', { method: 'POST', body });
      const payload = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.url) {
        setState({ status: 'error', message: payload?.error ?? 'No se pudo subir la imagen.' });
        return;
      }

      setState(await addProductImage({ productId, url: payload.url, alt: '' }));
    } catch {
      setState({ status: 'error', message: 'No se pudo conectar para subir la imagen.' });
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function ejecutar(accion: () => Promise<ActionResult>) {
    startTransition(async () => {
      setState(await accion());
    });
  }

  return (
    <section className="card">
      <div className="card-head">
        <h3>Imágenes</h3>
        <span className="tag">{images.length}</span>
      </div>

      <FormFeedback state={state} />

      {images.length === 0 ? (
        <p className="field-hint" style={{ marginBottom: 14 }}>
          Este producto no tiene imágenes. La primera que subas será la principal, que es la que
          sale en el catálogo.
        </p>
      ) : (
        <ul className="product-images">
          {images.map((image, indice) => (
            <li key={image.id} className={image.isPrimary ? 'is-primary' : undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.alt ?? ''} />

              {image.isPrimary ? <span className="tag tag-success">Principal</span> : null}

              <div className="product-images-actions">
                {!image.isPrimary ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={ocupado}
                    onClick={() => ejecutar(() => setPrimaryProductImage(productId, image.id))}
                  >
                    Hacer principal
                  </button>
                ) : null}
                <BotonDestructivo
                  disabled={ocupado}
                  etiqueta={`Borrar la imagen ${indice + 1}`}
                  confirmacion="¿Borrar esta imagen? Se elimina también del almacenamiento y no se puede deshacer."
                  alConfirmar={() => deleteProductImage(productId, image.id)}
                >
                  Borrar
                </BotonDestructivo>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="field">
        <label htmlFor="producto-imagen">Añadir imagen</label>
        <input
          ref={inputRef}
          id="producto-imagen"
          type="file"
          accept={storage.MEDIA_ACCEPT_ATTRIBUTE}
          disabled={ocupado}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void subir(file);
          }}
        />
        <span className="field-hint">
          {subiendo ? 'Subiendo… ' : ''}JPG, PNG, WebP o AVIF, hasta{' '}
          {storage.MAX_MEDIA_BYTES / (1024 * 1024)} MB.
        </span>
      </div>
    </section>
  );
}
