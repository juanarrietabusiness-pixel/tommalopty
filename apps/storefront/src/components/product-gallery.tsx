'use client';

import { useState } from 'react';
import { ImagePlaceholderIcon } from '@nebula/ui';

export interface GalleryImage {
  id: string;
  url: string;
  alt: string | null;
}

export function ProductGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  return (
    <div>
      <div className="gallery-main">
        {active ? (
          // <img> deliberado: el media se sirve desde R2/Supabase Storage con
          // dominios que varían por entorno y next/image exige fijarlos en build.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active.url} alt={active.alt ?? title} />
        ) : (
          <ImagePlaceholderIcon className="placeholder-icon" />
        )}
      </div>

      {images.length > 1 ? (
        <div className="gallery-thumbs" role="tablist" aria-label="Imágenes del producto">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              onClick={() => setActiveIndex(index)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.alt ?? `${title} — imagen ${index + 1}`} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
