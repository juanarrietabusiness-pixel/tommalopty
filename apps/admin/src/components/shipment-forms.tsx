'use client';

import { useActionState } from 'react';
import {
  SHIPMENT_STATUS_LABELS,
  allowedShipmentTransitions,
  type ShipmentStatus,
} from '@nebula/domain';
import { anularEnvio, createShipment, updateShipment } from '@/lib/actions/logistica';
import { IDLE } from '@/lib/actions/result';
import { BotonDestructivo } from './boton-destructivo';
import { FormFeedback, SubmitButton } from './form';

export interface EnvioEnPantalla {
  id: string;
  trackingNumber: string;
  status: ShipmentStatus;
  assignedTo: string | null;
  carrier: string | null;
  carrierTrackingNumber: string | null;
  tieneCoordenadas: boolean;
  tienePrueba: boolean;
  createdAt: string;
}

export function NuevoEnvioForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(async () => createShipment(orderId), IDLE);

  return (
    <form action={formAction}>
      <FormFeedback state={state} />
      <SubmitButton>Crear envío</SubmitButton>
    </form>
  );
}

/**
 * Cambiar el estado de un envío, y de paso decir quién lo lleva.
 *
 * El selector solo ofrece los destinos que la máquina de estados permite desde
 * donde está. Es la misma lista que usa el disparador de Postgres, así que la
 * pantalla no puede proponer algo que la base vaya a rechazar — y quien la usa
 * no descubre el límite después de rellenar el formulario.
 */
export function EnvioForm({
  envio,
  operadores,
}: {
  envio: EnvioEnPantalla;
  operadores: { id: string; nombre: string }[];
}) {
  const [state, formAction] = useActionState(updateShipment, IDLE);

  // «Anulado» sale del desplegable a propósito: no se deshace, y lo que no se
  // deshace se confirma. Tiene su propio botón, abajo. Ver `anularEnvio`.
  const destinos = allowedShipmentTransitions(envio.status).filter(
    (destino) => destino !== 'anulado',
  );
  const sePuedeAnular = allowedShipmentTransitions(envio.status).includes('anulado');

  return (
    <form action={formAction} className="envio-fila">
      <input type="hidden" name="shipmentId" value={envio.id} />

      <div className="envio-cabecera">
        <strong>{envio.trackingNumber}</strong>
        <span className="tag tag-dark">{SHIPMENT_STATUS_LABELS[envio.status]}</span>
      </div>

      <FormFeedback state={state} />

      {!envio.tieneCoordenadas ? (
        <p className="field-error">
          Sin punto en el mapa: el QR abrirá la guía, pero no podrá abrir Waze.
        </p>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor={`status-${envio.id}`}>Estado</label>
          <select id={`status-${envio.id}`} name="status" defaultValue={envio.status}>
            <option value={envio.status}>
              {SHIPMENT_STATUS_LABELS[envio.status]} (sin cambios)
            </option>
            {destinos.map((destino) => (
              <option key={destino} value={destino}>
                {SHIPMENT_STATUS_LABELS[destino]}
              </option>
            ))}
          </select>
          {destinos.length === 0 ? (
            <span className="field-hint">Este envío ya terminó su recorrido.</span>
          ) : null}
          {sePuedeAnular ? (
            <span className="field-hint">
              ¿Se creó por error? No se borra: se anula, con el botón de abajo.
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor={`assignedTo-${envio.id}`}>Quién lo lleva</label>
          <select
            id={`assignedTo-${envio.id}`}
            name="assignedTo"
            defaultValue={envio.assignedTo ?? ''}
          >
            <option value="">Sin asignar</option>
            {operadores.map((operador) => (
              <option key={operador.id} value={operador.id}>
                {operador.nombre}
              </option>
            ))}
          </select>
          <span className="field-hint">
            {operadores.length === 0
              ? 'No hay motorizados dados de alta. Se añaden en «Motorizados».'
              : 'En cuanto se lo asignes, le aparece en su aplicación.'}
          </span>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`carrier-${envio.id}`}>Courier externo</label>
          <input
            id={`carrier-${envio.id}`}
            name="carrier"
            defaultValue={envio.carrier ?? ''}
            placeholder="Servientrega · Dropi"
          />
        </div>
        <div className="field">
          <label htmlFor={`carrierTrackingNumber-${envio.id}`}>Su número de guía</label>
          <input
            id={`carrierTrackingNumber-${envio.id}`}
            name="carrierTrackingNumber"
            defaultValue={envio.carrierTrackingNumber ?? ''}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <SubmitButton>Guardar envío</SubmitButton>

        {sePuedeAnular ? (
          <BotonDestructivo
            etiqueta={`Anular el envío ${envio.trackingNumber}`}
            pendienteTexto="Anulando…"
            confirmacion={
              `Se anulará el envío ${envio.trackingNumber}. No se puede deshacer: ` +
              'si el pedido vuelve a despacharse será un envío nuevo, con otra guía.\n\n' +
              'La fila no se borra, para que una guía ya impresa siga existiendo en el sistema. ' +
              'Quien escanee su QR leerá que no la entregue.'
            }
            alConfirmar={() => anularEnvio(envio.id)}
          >
            Anular envío
          </BotonDestructivo>
        ) : null}
      </div>
    </form>
  );
}
