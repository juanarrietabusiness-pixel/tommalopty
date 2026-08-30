'use client';

import { useRef, useState } from 'react';
import { storage } from '@nebula/integrations';

/**
 * Campo de imagen: sube el archivo y deja su URL en un input oculto.
 *
 * El input oculto es lo que hace que esto encaje con el resto del panel sin
 * tocar nada: el formulario que lo contiene sigue enviando un campo de texto
 * con la URL, igual que cuando había que pegarla a mano.
 *
 * `accept` y el aviso de tamaño son comodidad para quien sube. Lo que de verdad
 * decide qué se acepta está en el servidor, que además lee los bytes en vez de
 * fiarse de la extensión.
 */
export function ImageUpload({
  name,
  kind,
  initialUrl = '',
  label = 'Imagen',
  hint,
}: {
  name: string;
  kind: storage.MediaKind;
  initialUrl?: string;
  label?: string;
  hint?: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function subir(file: File) {
    setSubiendo(true);
    setError(null);

    try {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', kind);

      const response = await fetch('/api/media', { method: 'POST', body });
      const payload = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.url) {
        setError(payload?.error ?? 'No se pudo subir la imagen.');
        return;
      }

      setUrl(payload.url);
    } catch {
      setError('No se pudo conectar para subir la imagen.');
    } finally {
      setSubiendo(false);
      // Permite volver a elegir el mismo archivo después de un fallo.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const inputId = `imagen-${name}`;

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>

      <input type="hidden" name={name} value={url} />

      {url ? (
        <div className="image-upload-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" />
          <div className="image-upload-preview-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setUrl('')}>
              Quitar
            </button>
          </div>
        </div>
      ) : null}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={storage.MEDIA_ACCEPT_ATTRIBUTE}
        disabled={subiendo}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void subir(file);
        }}
      />

      {subiendo ? <span className="field-hint">Subiendo…</span> : null}
      {error ? <span className="field-error">{error}</span> : null}

      <span className="field-hint">
        {hint ? `${hint} ` : ''}JPG, PNG, WebP o AVIF, hasta{' '}
        {storage.MAX_MEDIA_BYTES / (1024 * 1024)} MB.
      </span>
    </div>
  );
}
