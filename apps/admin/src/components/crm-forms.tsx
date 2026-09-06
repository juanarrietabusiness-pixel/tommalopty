'use client';

import { useActionState } from 'react';
import { anonimizarCliente, addCustomerNote, updateCustomerTags } from '@/lib/actions/crm';
import { IDLE } from '@/lib/actions/result';
import { BotonDestructivo } from './boton-destructivo';
import { FormFeedback, SubmitButton } from './form';

export function CustomerNoteForm({ customerId }: { customerId: string }) {
  const [state, formAction] = useActionState(addCustomerNote, IDLE);

  return (
    <form action={formAction}>
      <input type="hidden" name="customerId" value={customerId} />
      <FormFeedback state={state} />

      <div className="field">
        <label htmlFor="body">Nueva nota</label>
        <textarea id="body" name="body" placeholder="Solo la ve el equipo" required />
      </div>

      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontSize: '0.82rem',
          marginBottom: 14,
        }}
      >
        <input type="checkbox" name="isPinned" />
        Fijar arriba
      </label>

      <SubmitButton className="btn btn-outline btn-sm">Guardar nota</SubmitButton>
    </form>
  );
}

export function CustomerTagsForm({ customerId, tags }: { customerId: string; tags: string[] }) {
  const [state, formAction] = useActionState(updateCustomerTags, IDLE);

  return (
    <form action={formAction}>
      <input type="hidden" name="customerId" value={customerId} />
      <FormFeedback state={state} />

      <div className="field">
        <label htmlFor="tags">Etiquetas</label>
        <input id="tags" name="tags" defaultValue={tags.join(', ')} placeholder="VIP, Mayorista" />
        <span className="field-hint">Separadas por comas. Sirven para segmentar campañas.</span>
      </div>

      <SubmitButton className="btn btn-outline btn-sm">Guardar etiquetas</SubmitButton>
    </form>
  );
}

/**
 * Anonimizar un cliente: la respuesta a «¿por qué no puedo borrarlo?».
 *
 * Va en su propia tarjeta, al final y separada del resto, porque no es una
 * operación del día a día: es la que se hace cuando alguien ejerce su derecho a
 * desaparecer. Y solo la ve un superadministrador, que es quien puede.
 *
 * El diálogo dice las tres cosas que hay que saber antes de pulsar: qué se
 * borra, qué se queda y que no hay vuelta atrás. Un «¿Seguro?» aquí sería
 * negligente.
 */
export function AnonimizarClienteForm({
  customerId,
  nombre,
  esSuperadmin,
  yaAnonimizado,
}: {
  customerId: string;
  nombre: string;
  esSuperadmin: boolean;
  yaAnonimizado: boolean;
}) {
  if (yaAnonimizado) {
    return (
      <p className="field-hint">
        Esta ficha ya está anonimizada. Sus pedidos e importes se conservan; sus datos personales no
        están.
      </p>
    );
  }

  if (!esSuperadmin) {
    return (
      <p className="field-hint">
        Un cliente no se borra: se anonimiza, para que sus ventas sigan cuadrando sin que queden sus
        datos personales. Solo un superadministrador puede hacerlo.
      </p>
    );
  }

  return (
    <>
      <p className="field-hint" style={{ marginBottom: 12 }}>
        Un cliente no se borra: se anonimiza. Se van correo, nombre, teléfono, direcciones, notas
        del CRM, favoritos y suscripciones —y su cuenta de acceso, si tenía—. Se quedan los pedidos
        con sus números, importes y artículos, porque una venta que ocurrió hay que poder
        declararla.
      </p>
      <BotonDestructivo
        className="btn btn-outline btn-sm"
        etiqueta={`Anonimizar a ${nombre}`}
        pendienteTexto="Anonimizando…"
        confirmacion={
          `Se van a borrar los datos personales de ${nombre}: correo, nombre, teléfono, ` +
          'direcciones, notas del CRM, favoritos, suscripciones y su cuenta de acceso.\n\n' +
          'Se conservan sus pedidos con sus números, importes y artículos: una venta que ocurrió ' +
          'hay que poder declararla.\n\n' +
          'NO SE PUEDE DESHACER. No se guarda copia de lo que se sustituye; si la guardáramos, ' +
          'esto no sería anonimizar.'
        }
        alConfirmar={() => anonimizarCliente(customerId)}
      >
        Anonimizar cliente
      </BotonDestructivo>
    </>
  );
}
