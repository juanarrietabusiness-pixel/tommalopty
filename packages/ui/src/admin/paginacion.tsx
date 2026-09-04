import Link from 'next/link';

export interface PaginacionProps {
  pagina: number;
  totalPaginas: number;
  /** Índice humano de la primera y la última fila que se están enseñando. */
  desde: number;
  hasta: number;
  total: number;
  /** Cómo se llama lo que se lista, en plural: «pedidos», «clientes». */
  nombre: string;
  /** La dirección de una página. La construye quien llama, que es quien conoce sus filtros. */
  hrefDePagina: (pagina: number) => string;
}

/**
 * El pie de un listado largo: dónde estás y cómo pasar de página.
 *
 * Existe porque `/pedidos` y `/clientes` traían 50 filas, enseñaban el total
 * completo en la cabecera —«1.240 pedidos registrados»— y no ofrecían página
 * siguiente. La contradicción estaba a la vista y no había forma de resolverla:
 * un pedido de hace dos meses era inalcanzable salvo que se recordara su número.
 *
 * Son enlaces y no botones porque son enlaces: cambian de dirección, se pueden
 * abrir en otra pestaña, y funcionan sin JavaScript. El texto dice el rango y
 * no solo el número de página, porque «mostrando 51-100 de 1.240» responde la
 * pregunta que se hace de verdad, que es cuánto queda.
 */
export function Paginacion({
  pagina,
  totalPaginas,
  desde,
  hasta,
  total,
  nombre,
  hrefDePagina,
}: PaginacionProps) {
  // Con todo a la vista no hay nada que decidir, y un pie que solo repite el
  // total es ruido.
  if (totalPaginas <= 1) return null;

  const hayAnterior = pagina > 1;
  const haySiguiente = pagina < totalPaginas;

  return (
    <nav className="paginacion" aria-label={`Paginación de ${nombre}`}>
      <p className="paginacion-cuenta" aria-live="polite">
        Mostrando <strong>{desde.toLocaleString('es')}</strong>–
        <strong>{hasta.toLocaleString('es')}</strong> de {total.toLocaleString('es')} {nombre}
      </p>

      <div className="paginacion-botones">
        {hayAnterior ? (
          <Link href={hrefDePagina(pagina - 1)} className="btn btn-outline btn-sm" rel="prev">
            Anterior
          </Link>
        ) : (
          <span className="btn btn-outline btn-sm" aria-disabled="true">
            Anterior
          </span>
        )}

        <span className="paginacion-posicion">
          Página {pagina.toLocaleString('es')} de {totalPaginas.toLocaleString('es')}
        </span>

        {haySiguiente ? (
          <Link href={hrefDePagina(pagina + 1)} className="btn btn-outline btn-sm" rel="next">
            Siguiente
          </Link>
        ) : (
          <span className="btn btn-outline btn-sm" aria-disabled="true">
            Siguiente
          </span>
        )}
      </div>
    </nav>
  );
}
