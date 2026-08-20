import Link from 'next/link';

export interface SectionHeadProps {
  title: string;
  linkLabel?: string;
  linkHref?: string;
  /**
   * Nivel del encabezado. Por defecto `h2`, porque suele ser el título de una
   * sección dentro de una página. En una página cuyo tema ES esta sección
   * (catálogo, resultados de búsqueda) hay que pasar `h1`: sin un h1 la página
   * no le dice a Google ni a un lector de pantalla de qué trata.
   */
  as?: 'h1' | 'h2';
}

export function SectionHead({ title, linkLabel, linkHref, as: Heading = 'h2' }: SectionHeadProps) {
  return (
    <div className="section-head">
      <Heading>{title}</Heading>
      {linkLabel && linkHref ? (
        <Link href={linkHref} className="link-view-all">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
