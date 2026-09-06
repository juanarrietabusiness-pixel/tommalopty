'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { deleteMyAddress, saveMyAddress } from '@/lib/actions/cuenta';
import { ACCOUNT_IDLE, type AccountResult } from '@/lib/actions/cuenta-result';

/**
 * La libreta de direcciones del cliente: alta, edición y borrado.
 *
 * La pantalla llevaba desde el principio sabiendo leer direcciones y sin poder
 * escribir ninguna, así que enseñaba «aún no has guardado ninguna» a todo el
 * mundo, para siempre. Ver `saveMyAddress` en `lib/actions/cuenta.ts`.
 *
 * El formulario se monta con `key`, y eso no es decorativo: `useActionState`
 * guarda el resultado de la última llamada. Sin remontar, los errores de la
 * dirección que acabas de dejar aparecerían sobre la que abres después.
 */

export interface DireccionGuardada {
  id: string;
  label: string | null;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string | null;
  countryCode: string;
  postalCode: string | null;
  phone: string | null;
  isDefault: boolean;
}

/** Ni id ni dirección: el formulario en blanco. */
const NUEVA = 'nueva';

/**
 * En modo demostración los botones NO se deshabilitan.
 *
 * Es la misma decisión que ya tomó `AccountProfileForm`: quien recorre la
 * demostración tiene que poder abrir el formulario, rellenarlo y enviarlo, y
 * encontrarse el «esto es una demostración» que devuelve la acción. Un botón
 * gris no enseña nada — ni siquiera que la pantalla funciona.
 */
export function LibretaDeDirecciones({ direcciones }: { direcciones: DireccionGuardada[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [borrado, setBorrado] = useState<AccountResult>(ACCOUNT_IDLE);

  const abrir = (cual: string) => {
    setBorrado(ACCOUNT_IDLE);
    setAbierto(cual);
  };

  return (
    <>
      <Aviso state={borrado} />

      {abierto === NUEVA ? (
        <FormularioDeDireccion
          key={NUEVA}
          esLaPrimera={direcciones.length === 0}
          onCerrar={() => setAbierto(null)}
        />
      ) : (
        <p style={{ margin: '0 0 20px' }}>
          <button type="button" className="btn btn-dark btn-sm" onClick={() => abrir(NUEVA)}>
            Añadir dirección
          </button>
        </p>
      )}

      {direcciones.length === 0 && abierto !== NUEVA ? (
        <p className="field-hint">
          Aún no has guardado ninguna dirección. Guarda una aquí y la tendrás lista para tu próximo
          pedido.
        </p>
      ) : null}

      {direcciones.map((direccion) =>
        abierto === direccion.id ? (
          <FormularioDeDireccion
            key={direccion.id}
            direccion={direccion}
            esLaPrimera={false}
            onCerrar={() => setAbierto(null)}
          />
        ) : (
          <FichaDeDireccion
            key={direccion.id}
            direccion={direccion}
            onEditar={() => abrir(direccion.id)}
            onBorrado={setBorrado}
          />
        ),
      )}
    </>
  );
}

/** Una dirección guardada y lo que se puede hacer con ella. */
function FichaDeDireccion({
  direccion,
  onEditar,
  onBorrado,
}: {
  direccion: DireccionGuardada;
  onEditar: () => void;
  onBorrado: (resultado: AccountResult) => void;
}) {
  const [borrando, startTransition] = useTransition();
  const nombre = [direccion.firstName, direccion.lastName].filter(Boolean).join(' ');

  return (
    <article className="order-card">
      <div className="order-card-head">
        <strong>{direccion.label ? direccion.label : nombre}</strong>
        {direccion.isDefault ? <span className="tag tag-dark">Predeterminada</span> : null}
      </div>
      <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6 }}>
        {direccion.label ? (
          <>
            {nombre}
            <br />
          </>
        ) : null}
        {direccion.line1}
        {direccion.line2 ? `, ${direccion.line2}` : ''}
        <br />
        {direccion.city}
        {direccion.province ? `, ${direccion.province}` : ''} · {direccion.countryCode}
        {direccion.phone ? (
          <>
            <br />
            {direccion.phone}
          </>
        ) : null}
      </p>

      <p style={{ display: 'flex', gap: 8, margin: '14px 0 0' }}>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={borrando}
          onClick={onEditar}
          aria-label={`Editar ${direccion.label ?? nombre}`}
        >
          Editar
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={borrando}
          aria-label={`Borrar ${direccion.label ?? nombre}`}
          onClick={() => {
            // Se pregunta porque no se deshace, y el mensaje dice qué se pierde:
            // un «¿Seguro?» a secas no se puede responder con criterio.
            const aviso = `Se borrará la dirección «${direccion.label ?? nombre}» (${direccion.line1}). No se puede deshacer.\n\nTus pedidos anteriores no cambian: cada uno guarda su propia copia de la dirección a la que se envió.`;
            if (!window.confirm(aviso)) return;

            startTransition(async () => {
              onBorrado(await deleteMyAddress(direccion.id));
            });
          }}
        >
          {borrando ? 'Borrando…' : 'Borrar'}
        </button>
      </p>
    </article>
  );
}

/** El alta y la edición son el mismo formulario: cambia si lleva `id`. */
function FormularioDeDireccion({
  direccion,
  esLaPrimera,
  onCerrar,
}: {
  direccion?: DireccionGuardada;
  esLaPrimera: boolean;
  onCerrar: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveMyAddress, ACCOUNT_IDLE);

  // Guardar cierra el formulario. La lista ya se ha revalidado en el servidor,
  // así que la dirección nueva está debajo esperando; dejar el formulario
  // abierto invitaría a guardarla otra vez.
  useEffect(() => {
    if (state.status === 'success') onCerrar();
  }, [state, onCerrar]);

  return (
    <form action={formAction} className="order-card" style={{ marginBottom: 20 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '1rem' }}>
        {direccion ? 'Editar dirección' : 'Nueva dirección'}
      </h2>

      <Aviso state={state} />

      {direccion ? <input type="hidden" name="id" value={direccion.id} /> : null}

      <div className="field">
        <label htmlFor="label">Nombre de la dirección</label>
        <input
          id="label"
          name="label"
          defaultValue={direccion?.label ?? ''}
          placeholder="Casa, oficina…"
          {...campo(state, 'label')}
        />
        <span className="field-hint">Opcional. Sirve para reconocerla de un vistazo.</span>
        <Errores state={state} field="label" />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="firstName">Nombre de quien recibe</label>
          <input
            id="firstName"
            name="firstName"
            required
            defaultValue={direccion?.firstName ?? ''}
            {...campo(state, 'firstName')}
          />
          <Errores state={state} field="firstName" />
        </div>
        <div className="field">
          <label htmlFor="lastName">Apellido</label>
          <input
            id="lastName"
            name="lastName"
            required
            defaultValue={direccion?.lastName ?? ''}
            {...campo(state, 'lastName')}
          />
          <Errores state={state} field="lastName" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="line1">Dirección</label>
        <input
          id="line1"
          name="line1"
          required
          defaultValue={direccion?.line1 ?? ''}
          placeholder="Calle, edificio, casa"
          {...campo(state, 'line1')}
        />
        <Errores state={state} field="line1" />
      </div>

      <div className="field">
        <label htmlFor="line2">Piso, apartamento o referencia</label>
        <input
          id="line2"
          name="line2"
          defaultValue={direccion?.line2 ?? ''}
          {...campo(state, 'line2')}
        />
        <span className="field-hint">
          Opcional, pero es lo que evita una llamada cuando quien entrega llega al portón.
        </span>
        <Errores state={state} field="line2" />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="city">Ciudad</label>
          <input
            id="city"
            name="city"
            required
            defaultValue={direccion?.city ?? ''}
            {...campo(state, 'city')}
          />
          <Errores state={state} field="city" />
        </div>
        <div className="field">
          <label htmlFor="province">Provincia</label>
          <input
            id="province"
            name="province"
            defaultValue={direccion?.province ?? ''}
            {...campo(state, 'province')}
          />
          <Errores state={state} field="province" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="postalCode">Código postal</label>
          <input
            id="postalCode"
            name="postalCode"
            defaultValue={direccion?.postalCode ?? ''}
            {...campo(state, 'postalCode')}
          />
          <span className="field-hint">Opcional en Panamá.</span>
          <Errores state={state} field="postalCode" />
        </div>
        <div className="field">
          <label htmlFor="phone">Teléfono de contacto</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={direccion?.phone ?? ''}
            placeholder="6123-4567"
            {...campo(state, 'phone')}
          />
          <Errores state={state} field="phone" />
        </div>
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
          name="isDefault"
          defaultChecked={direccion?.isDefault ?? esLaPrimera}
          style={{ marginTop: 3 }}
        />
        Usar esta dirección por defecto en mis pedidos.
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-dark" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar dirección'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCerrar} disabled={pending}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/* --- Lo compartido ---------------------------------------------------------- */

/**
 * El aviso de la última acción.
 *
 * `role="alert"` para el error y `role="status"` para el acierto: lo que ha
 * salido mal interrumpe, lo que ha salido bien espera turno. Y recibe el foco,
 * porque quien envía con el teclado se queda en el botón y no vería el mensaje.
 */
function Aviso({ state }: { state: AccountResult }) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === 'error') caja.current?.focus();
  }, [state]);

  if (state.status === 'idle' || !state.message) return null;

  const error = state.status === 'error';
  return (
    <div
      ref={caja}
      tabIndex={-1}
      role={error ? 'alert' : 'status'}
      className={`notice notice-${error ? 'error' : 'success'}`}
    >
      {state.message}
    </div>
  );
}

function Errores({ state, field }: { state: AccountResult; field: string }) {
  const errores = state.fieldErrors?.[field];
  if (!errores?.length) return null;
  return (
    <span className="field-error" id={idDeError(field)}>
      {errores.join(' ')}
    </span>
  );
}

const idDeError = (field: string) => `error-${field}`;

/** Ata el campo con su error, para que un lector de pantalla lo lea al entrar. */
function campo(state: AccountResult, field: string) {
  const tieneError = Boolean(state.fieldErrors?.[field]?.length);
  return {
    'aria-invalid': tieneError || undefined,
    'aria-describedby': tieneError ? idDeError(field) : undefined,
  };
}
