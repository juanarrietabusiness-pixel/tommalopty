'use client';

import { useActionState } from 'react';
import type { DeliveryZone } from '@nebula/domain';
import {
  createDeliveryZone,
  deleteDeliveryZone,
  updateDeliveryZone,
} from '@/lib/actions/logistica';
import { IDLE } from '@/lib/actions/result';
import { FieldError, FormFeedback, SubmitButton, propsDeCampo } from './form';
import { ZoneMap } from './zone-map';
import { BotonDestructivo } from './boton-destructivo';

export interface ZonaEditable extends DeliveryZone {
  description: string | null;
  isActive: boolean;
  position: number;
}

export function ZoneForm({ zona }: { zona?: ZonaEditable }) {
  const [state, formAction] = useActionState(zona ? updateDeliveryZone : createDeliveryZone, IDLE);

  return (
    <form action={formAction} className="card">
      <div className="card-head">
        <h3>{zona ? `Editar «${zona.name}»` : 'Nueva zona de reparto'}</h3>
      </div>

      <FormFeedback state={state} />

      {zona ? <input type="hidden" name="id" value={zona.id} /> : null}

      <div className="field">
        <label htmlFor={`name-${zona?.id ?? 'nueva'}`}>Nombre</label>
        <input
          id={`name-${zona?.id ?? 'nueva'}`}
          name="name"
          required
          defaultValue={zona?.name}
          placeholder="Área metropolitana"
          {...propsDeCampo(state, 'name')}
        />
        <FieldError state={state} field="name" />
      </div>

      <div className="field">
        <label htmlFor={`description-${zona?.id ?? 'nueva'}`}>Descripción</label>
        <input
          id={`description-${zona?.id ?? 'nueva'}`}
          name="description"
          defaultValue={zona?.description ?? ''}
          placeholder="Para qué sirve esta zona, si no es obvio por el nombre"
          {...propsDeCampo(state, 'polygon')}
        />
      </div>

      <ZoneMap valorInicial={zona ? zona.polygon.map(([lng, lat]) => [lng, lat]) : []} />
      <FieldError state={state} field="polygon" />

      <div className="field-row">
        <div className="field">
          <label htmlFor={`shippingPrice-${zona?.id ?? 'nueva'}`}>Tarifa propia</label>
          <input
            id={`shippingPrice-${zona?.id ?? 'nueva'}`}
            name="shippingPrice"
            type="number"
            min="0"
            step="0.01"
            defaultValue={zona?.shippingPrice ?? ''}
            placeholder="Vacío = usa el método de envío normal"
            {...propsDeCampo(state, 'shippingPrice')}
          />
          <FieldError state={state} field="shippingPrice" />
        </div>

        <div className="field">
          <label htmlFor={`handledBy-${zona?.id ?? 'nueva'}`}>Quién reparte</label>
          <select
            id={`handledBy-${zona?.id ?? 'nueva'}`}
            name="handledBy"
            defaultValue={zona?.handledBy ?? 'propio'}
          >
            <option value="propio">Reparto propio (motorizados)</option>
            <option value="courier">Courier externo</option>
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`position-${zona?.id ?? 'nueva'}`}>Orden</label>
          <input
            id={`position-${zona?.id ?? 'nueva'}`}
            name="position"
            type="number"
            min="0"
            defaultValue={zona?.position ?? 0}
          />
          {/*
            El orden no es decorativo: cuando dos zonas se solapan gana la
            primera, así que aquí se decide qué tarifa se aplica.
          */}
          <span className="field-hint">
            Si dos zonas se solapan, se aplica la que tenga el número más bajo.
          </span>
        </div>

        <div className="field">
          <label htmlFor={`isActive-${zona?.id ?? 'nueva'}`}>Activa</label>
          <input
            id={`isActive-${zona?.id ?? 'nueva'}`}
            name="isActive"
            type="checkbox"
            defaultChecked={zona?.isActive ?? true}
          />
          <span className="field-hint">Una zona inactiva no la ve el checkout.</span>
        </div>
      </div>

      <SubmitButton>{zona ? 'Guardar cambios' : 'Crear zona'}</SubmitButton>
    </form>
  );
}

export function ZoneDeleteButton({ id, nombre }: { id: string; nombre: string }) {
  return (
    <BotonDestructivo
      etiqueta={`Eliminar la zona ${nombre}`}
      confirmacion={`¿Eliminar la zona «${nombre}»? Los pedidos de esa área dejan de cotizarse, y no se puede deshacer.`}
      alConfirmar={() => deleteDeliveryZone(id)}
    >
      Eliminar
    </BotonDestructivo>
  );
}
