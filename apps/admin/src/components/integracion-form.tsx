'use client';

import { useActionState } from 'react';
import type { credenciales } from '@nebula/integrations';
import { guardarCredenciales, revocarCredencial } from '@/lib/actions/credenciales';
import { IDLE } from '@/lib/actions/result';
import { FormFeedback, SubmitButton } from './form';

export interface CampoConEstado {
  campo: credenciales.CampoDeCredencial;
  pista: string | null;
  origen: 'boveda' | 'entorno' | null;
}

/**
 * Una integración, plegada.
 *
 * Va dentro de un `<details>` nativo y no de un acordeón hecho a mano. Es la
 * decisión que resuelve el scroll infinito, y de paso resuelve la accesibilidad
 * gratis: `<details>` se abre con teclado, lo anuncian los lectores de pantalla,
 * y funciona aunque el JavaScript no haya cargado. Un `div` con `onClick` no
 * hace ninguna de las tres cosas sin escribirlas a mano.
 */
export function IntegracionForm({
  integracion,
  campos,
  configurada,
  puedeEditar,
  bovedaDisponible,
}: {
  integracion: credenciales.Integracion;
  campos: CampoConEstado[];
  configurada: boolean;
  puedeEditar: boolean;
  bovedaDisponible: boolean;
}) {
  const [state, formAction] = useActionState(
    guardarCredenciales.bind(null, integracion.proveedor),
    IDLE,
  );

  const puestas = campos.filter((c) => c.origen !== null).length;

  return (
    <details className="integracion">
      <summary className="integracion-cabecera">
        <span className="integracion-nombre">
          {integracion.nombre}
          {integracion.bloqueadaPor ? <span className="tag tag-muted">En espera</span> : null}
        </span>

        <span className="integracion-resumen">{integracion.resumen}</span>

        {configurada ? (
          <span className="tag tag-success">Lista</span>
        ) : (
          <span className="tag tag-warning">
            {puestas === 0 ? 'Sin configurar' : `Faltan ${campos.length - puestas}`}
          </span>
        )}
      </summary>

      <div className="integracion-cuerpo">
        {integracion.bloqueadaPor ? (
          <p className="notice notice-info">{integracion.bloqueadaPor}</p>
        ) : null}

        {integracion.donde ? <p className="field-hint">{integracion.donde}</p> : null}

        <form action={formAction}>
          <FormFeedback state={state} />

          {campos.map(({ campo, pista, origen }) => (
            <div className="field" key={campo.clave}>
              <label htmlFor={campo.clave}>
                {campo.etiqueta}
                {campo.requerido ? null : <span className="field-opcional"> · opcional</span>}
              </label>

              <input
                id={campo.clave}
                name={campo.clave}
                type={campo.secreto ? 'password' : 'text'}
                // Nunca se rellena con el valor: un secreto que llega al
                // navegador está en el HTML, en la memoria de la pestaña y en
                // cualquier extensión que lea el formulario.
                defaultValue=""
                placeholder={pista ?? campo.ejemplo ?? ''}
                autoComplete="off"
                spellCheck={false}
                disabled={!puedeEditar || !bovedaDisponible}
              />

              <span className="field-hint">
                {origen === 'boveda' ? <>Guardada aquí · {pista}. </> : null}
                {origen === 'entorno' ? (
                  <>
                    Viene del hosting · {pista}. Si escribes una aquí, esta manda a partir de
                    ahora.{' '}
                  </>
                ) : null}
                {campo.ayuda}
              </span>

              {origen === 'boveda' && puedeEditar ? <BotonRevocar clave={campo.clave} /> : null}
            </div>
          ))}

          {puedeEditar && bovedaDisponible ? (
            <>
              <p className="field-hint">
                Lo que dejes en blanco se queda como está. Solo se guarda lo que escribas.
              </p>
              <SubmitButton className="btn btn-dark btn-sm" />
            </>
          ) : null}

          {!puedeEditar ? (
            <p className="field-hint">Solo un superadministrador puede cambiar credenciales.</p>
          ) : null}
        </form>
      </div>
    </details>
  );
}

/** Revocar es su propio botón porque borrar nunca debe ser un efecto secundario de guardar. */
function BotonRevocar({ clave }: { clave: string }) {
  const [state, formAction] = useActionState(revocarCredencial.bind(null, clave), IDLE);

  return (
    <form action={formAction} className="integracion-revocar">
      <FormFeedback state={state} />
      <button type="submit" className="btn btn-ghost btn-xs">
        Revocar
      </button>
    </form>
  );
}
