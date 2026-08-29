'use client';

import { useActionState } from 'react';
import { ACCOUNT_IDLE, updateMyProfile, type AccountResult } from '@/lib/actions/cuenta';

export interface ProfileValues {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  acceptsMarketing: boolean;
}

function Errores({ state, field }: { state: AccountResult; field: string }) {
  const errores = state.fieldErrors?.[field];
  if (!errores?.length) return null;
  return <span className="field-error">{errores.join(' ')}</span>;
}

export function AccountProfileForm({ initial }: { initial: ProfileValues }) {
  const [state, formAction, pending] = useActionState(updateMyProfile, ACCOUNT_IDLE);

  return (
    <form action={formAction}>
      {state.status !== 'idle' && state.message ? (
        <div className={`notice notice-${state.status === 'success' ? 'success' : 'error'}`}>
          {state.message}
        </div>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor="firstName">Nombre</label>
          <input id="firstName" name="firstName" defaultValue={initial.firstName} required />
          <Errores state={state} field="firstName" />
        </div>
        <div className="field">
          <label htmlFor="lastName">Apellido</label>
          <input id="lastName" name="lastName" defaultValue={initial.lastName} />
          <Errores state={state} field="lastName" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="phone">Teléfono</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={initial.phone}
          placeholder="6123-4567"
        />
        <span className="field-hint">
          Lo usamos para avisarte de la entrega. Es lo que más acelera un pedido cuando quien lo
          lleva no encuentra la dirección.
        </span>
        <Errores state={state} field="phone" />
      </div>

      <div className="field">
        <label htmlFor="email">Correo</label>
        <input id="email" type="email" value={initial.email} disabled readOnly />
        <span className="field-hint">
          El correo identifica tu cuenta y tu historial de compras, así que no se cambia desde aquí.
          Escríbenos si lo necesitas.
        </span>
      </div>

      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
          fontSize: '0.85rem',
          margin: '4px 0 20px',
        }}
      >
        <input
          type="checkbox"
          name="acceptsMarketing"
          defaultChecked={initial.acceptsMarketing}
          style={{ marginTop: 3 }}
        />
        Quiero recibir novedades y ofertas por correo. Puedes desactivarlo cuando quieras.
      </label>

      <button type="submit" className="btn btn-dark" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
