'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  SHIPMENT_STATUS_LABELS,
  ahorroDeLaRuta,
  mejorCandidato,
  proponerRuta,
  sugerirMotorizado,
  PANAMA_CITY_CENTER,
  type DeliveryZone,
  type MotorizadoDisponible,
} from '@nebula/domain';
import { asignarEnvio } from '@/lib/actions/despacho';
import type { EnvioParaDespachar } from '@/lib/panel-data';

/**
 * La pantalla de despacho: qué hay que mover y quién lo mueve.
 *
 * SE ELIGE TOCANDO, NO ARRASTRANDO
 *
 * El plan pedía arrastrar. Se hace con clic por dos motivos que pesan más que la
 * comodidad del ratón: **arrastrar no se puede hacer con el teclado**, y este
 * repositorio pasa auditoría de accesibilidad en cada PR; y un arrastre fallido
 * en una lista larga suelta el envío en el motorizado de al lado sin que nadie
 * se entere. Tocar un envío y tocar a quien se lo lleva es más lento de contar y
 * más rápido de hacer.
 *
 * LA SUGERENCIA EXPLICA POR QUÉ, Y NO DECIDE
 *
 * Cada candidato sale con su motivo —cubre la zona, lleva tres, su entrega más
 * cercana está a 1,2 km— y los que no se pueden proponer salen igual, al final,
 * diciendo por qué. Saber que fulano está en pausa vale tanto como saber a quién
 * proponer: sin eso, quien despacha se pregunta dónde se metió.
 */
export function DespachoPanel({
  envios,
  motorizados,
  zonas,
  enPausaOInactivos,
}: {
  envios: EnvioParaDespachar[];
  motorizados: MotorizadoDisponible[];
  zonas: DeliveryZone[];
  enPausaOInactivos: number;
}) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const sinAsignar = envios.filter((envio) => envio.assignedTo === null);
  const asignados = envios.filter((envio) => envio.assignedTo !== null);

  const envio = envios.find((e) => e.id === seleccionado) ?? null;

  const candidatos = useMemo(
    () => (envio ? sugerirMotorizado(envio.punto, motorizados, zonas) : []),
    [envio, motorizados, zonas],
  );

  const recomendado = mejorCandidato(candidatos);

  /**
   * La ruta propuesta de cada motorizado que lleva algo encima.
   *
   * Se calcula aquí y no en el servidor porque son unas pocas decenas de puntos
   * y el cálculo es de milisegundos: mandarlo al servidor añadiría una vuelta de
   * red para no ahorrar nada, y obligaría a recargar la página para ver el
   * efecto de una asignación.
   */
  const rutas = useMemo(() => {
    const porMotorizado = new Map<string, EnvioParaDespachar[]>();

    for (const asignado of asignados) {
      if (!asignado.assignedTo) continue;
      const lista = porMotorizado.get(asignado.assignedTo) ?? [];
      lista.push(asignado);
      porMotorizado.set(asignado.assignedTo, lista);
    }

    return motorizados
      .filter((motorizado) => porMotorizado.has(motorizado.id))
      .map((motorizado) => {
        const suyos = porMotorizado.get(motorizado.id) ?? [];
        const ruta = proponerRuta(
          // Sin posición en vivo, la ruta se propone desde el centro de la
          // ciudad. Es una suposición y se dice en pantalla: cuando exista la
          // posición del motorizado, este es el único punto que cambia.
          PANAMA_CITY_CENTER,
          suyos.map((e) => ({ id: e.id, punto: e.punto })),
        );

        return { motorizado, ruta, ahorro: ahorroDeLaRuta(ruta), envios: suyos };
      });
  }, [asignados, motorizados]);

  function asignar(motorizadoId: string | null) {
    if (!envio) return;
    setAviso(null);

    startTransition(async () => {
      const resultado = await asignarEnvio(envio.id, motorizadoId);
      setAviso(resultado.message ?? null);
      if (resultado.status === 'success') setSeleccionado(null);
    });
  }

  if (envios.length === 0) {
    return (
      <div className="notice notice-info">
        No hay envíos que despachar. Los envíos se crean desde la ficha de cada pedido, y aparecen
        aquí en cuanto existen.
      </div>
    );
  }

  return (
    <>
      {aviso ? <div className="notice notice-info">{aviso}</div> : null}

      {motorizados.length === 0 ? (
        <div className="notice notice-info">
          No hay motorizados dados de alta, así que no se puede asignar nada. Se añaden en{' '}
          <a href="/motorizados">Motorizados</a>.
        </div>
      ) : null}

      <div className="despacho">
        <section className="despacho-columna">
          <h2>
            Sin asignar <span className="despacho-cuenta">{sinAsignar.length}</span>
          </h2>

          {sinAsignar.length === 0 ? (
            <p className="field-hint">Todo lo pendiente tiene quien lo lleve.</p>
          ) : (
            <ul className="despacho-lista">
              {sinAsignar.map((pendienteDeAsignar) => (
                <li key={pendienteDeAsignar.id}>
                  <button
                    type="button"
                    className="despacho-envio"
                    aria-pressed={seleccionado === pendienteDeAsignar.id}
                    onClick={() =>
                      setSeleccionado(
                        seleccionado === pendienteDeAsignar.id ? null : pendienteDeAsignar.id,
                      )
                    }
                  >
                    <span className="despacho-guia">{pendienteDeAsignar.trackingNumber}</span>
                    <strong>{pendienteDeAsignar.destino}</strong>
                    {pendienteDeAsignar.referencia ? (
                      <span className="cell-muted">{pendienteDeAsignar.referencia}</span>
                    ) : null}
                    {!pendienteDeAsignar.punto ? (
                      <span className="tag tag-danger">Sin punto en el mapa</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="despacho-columna">
          <h2>A quién dárselo</h2>

          {!envio ? (
            <p className="field-hint">
              Elige un envío de la izquierda y aquí sale a quién conviene dárselo, y por qué.
            </p>
          ) : (
            <>
              <p className="despacho-elegido">
                <span className="despacho-guia">{envio.trackingNumber}</span>
                <strong>{envio.destino}</strong>
              </p>

              {!envio.punto ? (
                <div className="notice notice-info">
                  Este envío no tiene punto en el mapa, así que no se puede saber su zona ni quién
                  lo tiene cerca. Queda ordenar por carga, que es poco.
                </div>
              ) : null}

              <ul className="despacho-candidatos">
                {candidatos.map((candidato) => (
                  <li key={candidato.motorizadoId} data-proponible={candidato.proponible}>
                    <div>
                      <strong>{candidato.nombre}</strong>
                      {candidato.motorizadoId === recomendado?.motorizadoId ? (
                        <span className="tag tag-success">Recomendado</span>
                      ) : null}
                      <span className="cell-muted">{candidato.motivo}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-dark btn-sm"
                      disabled={!candidato.proponible || pendiente}
                      onClick={() => asignar(candidato.motorizadoId)}
                    >
                      {pendiente ? 'Asignando…' : 'Asignar'}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {enPausaOInactivos > 0 ? (
            <p className="field-hint">
              {enPausaOInactivos}{' '}
              {enPausaOInactivos === 1
                ? 'motorizado no está activo'
                : 'motorizados no están activos'}{' '}
              y por eso no reciben entregas nuevas.
            </p>
          ) : null}
        </section>
      </div>

      <h2 className="seccion-titulo">Lo que lleva cada uno, y en qué orden conviene</h2>

      {rutas.length === 0 ? (
        <p className="field-hint">Todavía no hay nada asignado.</p>
      ) : (
        rutas.map(({ motorizado, ruta, ahorro, envios: suyos }) => (
          <section className="card despacho-ruta" key={motorizado.id}>
            <div className="card-head">
              <h3>
                {motorizado.nombre} · {suyos.length} {suyos.length === 1 ? 'entrega' : 'entregas'}
              </h3>
              <span className="cell-muted">
                {ruta.distanciaKm.toFixed(1)} km
                {ahorro.km > 0.3 ? ` · ${ahorro.km.toFixed(1)} km menos que el orden actual` : ''}
              </span>
            </div>

            <ol className="despacho-orden">
              {ruta.orden.map((parada, i) => {
                const suyo = suyos.find((e) => e.id === parada.id);
                return (
                  <li key={parada.id}>
                    <span className="despacho-paso">{i + 1}</span>
                    <span>
                      <strong>{suyo?.destino}</strong>
                      <span className="cell-muted">
                        {suyo?.trackingNumber} · {suyo ? SHIPMENT_STATUS_LABELS[suyo.status] : ''}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={pendiente}
                      onClick={() => {
                        setSeleccionado(parada.id);
                        void asignarEnvio(parada.id, null).then((r) => setAviso(r.message ?? null));
                      }}
                    >
                      Quitar
                    </button>
                  </li>
                );
              })}
            </ol>

            {ruta.sinUbicar.length > 0 ? (
              <p className="notice notice-info">
                {ruta.sinUbicar.length}{' '}
                {ruta.sinUbicar.length === 1 ? 'entrega no tiene' : 'entregas no tienen'} punto en
                el mapa, así que no entran en el orden propuesto. Hay que llamar para encontrarlas.
              </p>
            ) : null}

            <p className="field-hint">
              El orden se propone desde el centro de la ciudad y en línea recta: no es distancia de
              conducción. Quien reparte conoce el barrio mejor.
            </p>
          </section>
        ))
      )}
    </>
  );
}
