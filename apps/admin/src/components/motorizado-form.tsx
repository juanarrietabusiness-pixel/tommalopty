'use client';

import { useActionState } from 'react';
import {
  ESTADOS_MOTORIZADO,
  ESTADO_MOTORIZADO_AYUDA,
  ESTADO_MOTORIZADO_LABELS,
  VEHICULOS,
  VEHICULO_LABELS,
  documentosPorVencer,
  type DeliveryZone,
} from '@nebula/domain';
import type { Motorizado } from '@nebula/db';
import {
  actualizarMotorizado,
  crearMotorizado,
  darDeBajaMotorizado,
} from '@/lib/actions/motorizados';
import { IDLE } from '@/lib/actions/result';
import { FieldError, FormFeedback, SubmitButton, propsDeCampo } from './form';

export interface CandidatoAMotorizado {
  id: string;
  email: string;
  fullName: string | null;
}

/**
 * Alta y edición de un motorizado.
 *
 * La cuenta no se crea aquí: se elige de entre las que ya existen. Crear cuentas
 * desde el panel obliga a inventarle una contraseña a alguien y a hacérsela
 * llegar, que es exactamente como se filtran las credenciales de reparto. La
 * persona se registra en la tienda como cualquiera, y aquí se la convierte.
 */
export function MotorizadoForm({
  motorizado,
  zonas,
  candidatos,
  hoy,
}: {
  motorizado?: Motorizado;
  zonas: DeliveryZone[];
  candidatos: CandidatoAMotorizado[];
  /** El día de hoy en Panamá, `YYYY-MM-DD`. Lo calcula el servidor. */
  hoy: string;
}) {
  const [state, formAction] = useActionState(
    motorizado ? actualizarMotorizado : crearMotorizado,
    IDLE,
  );

  const id = motorizado?.id ?? 'nuevo';
  const avisos = motorizado ? documentosPorVencer(motorizado.documents, hoy) : [];

  return (
    <form action={formAction} className="card">
      <div className="card-head">
        <h3>{motorizado ? `Editar a ${motorizado.displayName}` : 'Dar de alta un motorizado'}</h3>
      </div>

      <FormFeedback state={state} />

      {avisos.length > 0 ? (
        <div className="notice notice-error">
          {avisos.map(({ documento, diasRestantes }) => (
            <div key={documento.tipo}>
              {diasRestantes < 0
                ? `Su ${documento.tipo} venció hace ${Math.abs(diasRestantes)} días.`
                : `Su ${documento.tipo} vence en ${diasRestantes} días.`}
            </div>
          ))}
        </div>
      ) : null}

      {motorizado ? <input type="hidden" name="courierId" value={motorizado.id} /> : null}

      <div className="field">
        <label htmlFor={`profileId-${id}`}>Cuenta</label>
        {motorizado ? (
          <>
            {/*
              La cuenta no se cambia después del alta: los envíos que ya llevó
              apuntan a ella, y moverla dejaría su historial atribuido a otra
              persona. Para cambiar de cuenta se da de baja y se da de alta.
            */}
            <input type="hidden" name="profileId" value={motorizado.profileId} />
            <p className="field-hint">
              La cuenta no se cambia después del alta: los envíos que ya llevó apuntan a ella.
            </p>
          </>
        ) : (
          <>
            <select
              id={`profileId-${id}`}
              name="profileId"
              required
              defaultValue=""
              {...propsDeCampo(state, 'profileId')}
            >
              <option value="" disabled>
                Elige la cuenta de la persona
              </option>
              {candidatos.map((candidato) => (
                <option key={candidato.id} value={candidato.id}>
                  {candidato.fullName ? `${candidato.fullName} · ` : ''}
                  {candidato.email}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Solo salen cuentas de cliente activas. Si no está, pídele que se registre en la tienda
              primero.
            </span>
            <FieldError state={state} field="profileId" />
          </>
        )}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`displayName-${id}`}>Nombre</label>
          <input
            id={`displayName-${id}`}
            name="displayName"
            required
            defaultValue={motorizado?.displayName}
            placeholder="Con el que lo llaman"
            {...propsDeCampo(state, 'displayName')}
          />
          <FieldError state={state} field="displayName" />
        </div>
        <div className="field">
          <label htmlFor={`phone-${id}`}>Teléfono</label>
          <input
            id={`phone-${id}`}
            name="phone"
            type="tel"
            defaultValue={motorizado?.phone ?? ''}
            placeholder="6123-4567"
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`vehicleType-${id}`}>Vehículo</label>
          <select
            id={`vehicleType-${id}`}
            name="vehicleType"
            defaultValue={motorizado?.vehicleType ?? 'moto'}
          >
            {VEHICULOS.map((vehiculo) => (
              <option key={vehiculo} value={vehiculo}>
                {VEHICULO_LABELS[vehiculo]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`plate-${id}`}>Placa</label>
          <input id={`plate-${id}`} name="plate" defaultValue={motorizado?.plate ?? ''} />
        </div>
        <div className="field">
          <label htmlFor={`nationalId-${id}`}>Cédula</label>
          <input
            id={`nationalId-${id}`}
            name="nationalId"
            defaultValue={motorizado?.nationalId ?? ''}
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`rate-${id}`}>Tarifa por entrega</label>
          <input
            id={`rate-${id}`}
            name="rate"
            type="number"
            step="0.01"
            min="0"
            defaultValue={motorizado?.rate ?? ''}
            placeholder="Déjalo vacío si va a sueldo"
            {...propsDeCampo(state, 'rate')}
          />
          <FieldError state={state} field="rate" />
        </div>
        <div className="field">
          <label htmlFor={`status-${id}`}>Situación</label>
          <select id={`status-${id}`} name="status" defaultValue={motorizado?.status ?? 'activo'}>
            {ESTADOS_MOTORIZADO.map((estado) => (
              <option key={estado} value={estado}>
                {ESTADO_MOTORIZADO_LABELS[estado]}
              </option>
            ))}
          </select>
          <span className="field-hint">
            {ESTADO_MOTORIZADO_AYUDA[motorizado?.status ?? 'activo']}
          </span>
        </div>
      </div>

      <div className="field">
        <span className="field-label">Zonas que cubre</span>
        {zonas.length === 0 ? (
          <p className="field-hint">
            Todavía no hay zonas de reparto dibujadas. Se crean en «Reparto y despacho».
          </p>
        ) : (
          <div className="checkbox-grid">
            {zonas.map((zona) => (
              <label key={zona.id} className="checkbox-item">
                <input
                  type="checkbox"
                  name="zoneIds"
                  value={zona.id}
                  defaultChecked={motorizado?.zoneIds.includes(zona.id)}
                />
                <span>{zona.name}</span>
              </label>
            ))}
          </div>
        )}
        <span className="field-hint">
          Sirve para proponer a quién asignarle cada envío. No le impide llevar uno de fuera.
        </span>
      </div>

      <div className="field">
        <label htmlFor={`notes-${id}`}>Notas</label>
        <textarea
          id={`notes-${id}`}
          name="notes"
          maxLength={500}
          defaultValue={motorizado?.notes ?? ''}
        />
      </div>

      <SubmitButton>{motorizado ? 'Guardar' : 'Dar de alta'}</SubmitButton>
    </form>
  );
}

/**
 * Da de baja, y lo dice como lo que es.
 *
 * No borra: los envíos que llevó apuntan a esa cuenta, y borrarla dejaría la
 * pregunta «quién entregó esto» sin respuesta justo cuando alguien la hace.
 */
export function MotorizadoBajaButton({ motorizado }: { motorizado: Motorizado }) {
  return (
    <form
      action={async () => {
        await darDeBajaMotorizado(motorizado.id);
      }}
    >
      <button type="submit" className="btn btn-outline btn-sm">
        Dar de baja
      </button>
    </form>
  );
}
