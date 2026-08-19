import Link from 'next/link';

/**
 * Bloque de campaña. Sin imagen del CMS, cae al degradado del esqueleto
 * original y muestra la etiqueta de marcador de posición.
 */
export interface HeroProps {
  eyebrow?: string | null;
  title?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  mediaUrl?: string | null;
}

export function Hero({ eyebrow, title, subtitle, ctaLabel, ctaHref, mediaUrl }: HeroProps) {
  const hasMedia = Boolean(mediaUrl);

  return (
    <section
      className="hero"
      data-has-media={hasMedia}
      style={hasMedia ? ({ '--hero-image': `url(${mediaUrl})` } as React.CSSProperties) : undefined}
    >
      {!hasMedia ? (
        <span className="hero-placeholder-tag">Imagen de campaña — placeholder</span>
      ) : null}
      <div className="container">
        <div className="hero-content">
          {eyebrow ? <span className="hero-eyebrow">{eyebrow}</span> : null}
          <h1>{title ?? 'Toda la tienda en descuento'}</h1>
          {subtitle ? <p className="hero-subtitle">{subtitle}</p> : null}
          {ctaLabel ? (
            <Link href={ctaHref ?? '/tienda'} className="btn btn-outline-light">
              {ctaLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
