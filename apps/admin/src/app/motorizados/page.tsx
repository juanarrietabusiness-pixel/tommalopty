import type { Metadata } from 'next';
import { ESTADO_MOTORIZADO_LABELS, VEHICULO_LABELS } from '@nebula/domain';
import { DataTable } from '@nebula/ui/admin';
import { PanelPage } from '@/components/panel-page';
import { MotorizadoBajaButton, MotorizadoForm } from '@/components/motorizado-form';
import { requireAdmin } from '@/lib/auth';
import { cargarMotorizados } from '@/lib/panel-data';

export const metadata: Metadata = { title: 'Motorizados' };

export const dynamic = 'force-dynamic';

/**
 * El día de hoy en Panamá.
 *
 * No se usa la fecha del servidor: corre en UTC, y a partir de las 19:00 de
 * Panamá el día UTC ya cambió. Un documento vencería en el panel unas horas
 * antes de estarlo de verdad. Es la misma trampa que en el hash de sesión de
 * Yappy, y por eso se resuelve igual.
 */
function hoyEnPanama(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Panama',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default async function MotorizadosPage() {
  await requireAdmin();

  const { motorizados, zonas, candidatos } = await cargarMotorizados();
  const hoy = hoyEnPanama();

  const nombreDeZona = new Map(zonas.map((zona) => [zona.id, zona.name]));

  return (
    <PanelPage
      title="Motorizados"
      description="Quién reparte, qué zonas cubre y qué papeles tiene al día."
    >
      <div className="notice notice-info">
        Un motorizado no entra a este panel: entra a <strong>/motorizado</strong> desde la tienda,
        con la misma cuenta con la que se registró. Ahí ve solo los envíos que lleva encima.
      </div>

      <DataTable
        rows={motorizados}
        rowKey={(motorizado) => motorizado.id}
        emptyMessage="Todavía no hay motorizados dados de alta."
        columns={[
          {
            key: 'nombre',
            header: 'Motorizado',
            render: (motorizado) => (
              <div>
                <span className="cell-strong">{motorizado.displayName}</span>
                <div className="cell-muted">
                  {VEHICULO_LABELS[motorizado.vehicleType]}
                  {motorizado.plate ? ` · ${motorizado.plate}` : ''}
                  {motorizado.phone ? ` · ${motorizado.phone}` : ''}
                </div>
              </div>
            ),
          },
          {
            key: 'estado',
            header: 'Situación',
            render: (motorizado) => (
              <span
                className={
                  motorizado.status === 'activo'
                    ? 'tag tag-success'
                    : motorizado.status === 'pausa'
                      ? 'tag tag-dark'
                      : 'tag tag-danger'
                }
              >
                {ESTADO_MOTORIZADO_LABELS[motorizado.status]}
              </span>
            ),
          },
          {
            key: 'zonas',
            header: 'Zonas',
            render: (motorizado) => (
              <span className="cell-muted">
                {motorizado.zoneIds.length === 0
                  ? 'Sin zona asignada'
                  : motorizado.zoneIds.map((zoneId) => nombreDeZona.get(zoneId) ?? '—').join(', ')}
              </span>
            ),
          },
          {
            key: 'tarifa',
            header: 'Por entrega',
            render: (motorizado) => (
              <span className="cell-muted">
                {motorizado.rate === null ? 'A sueldo' : `$${motorizado.rate.toFixed(2)}`}
              </span>
            ),
          },
          {
            key: 'baja',
            header: '',
            render: (motorizado) =>
              motorizado.status === 'inactivo' ? null : (
                <MotorizadoBajaButton motorizado={motorizado} />
              ),
          },
        ]}
      />

      <h2 className="seccion-titulo">Dar de alta</h2>
      <MotorizadoForm zonas={zonas} candidatos={candidatos} hoy={hoy} />

      {motorizados.length > 0 ? (
        <>
          <h2 className="seccion-titulo">Editar</h2>
          {motorizados.map((motorizado) => (
            <MotorizadoForm
              key={motorizado.id}
              motorizado={motorizado}
              zonas={zonas}
              candidatos={candidatos}
              hoy={hoy}
            />
          ))}
        </>
      ) : null}
    </PanelPage>
  );
}
