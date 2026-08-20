'use client';

import { useActionState } from 'react';
import { updateInventory } from '@/lib/actions/catalog-extra';
import { IDLE } from '@/lib/actions/result';
import { SubmitButton } from './form';

/** Ajuste rápido de stock en línea, sin salir del listado. */
export function InventoryRowForm({
  variantId,
  quantity,
  lowStockThreshold,
}: {
  variantId: string;
  quantity: number;
  lowStockThreshold: number;
}) {
  const [state, formAction] = useActionState(updateInventory, IDLE);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input type="hidden" name="variantId" value={variantId} />
      <input
        type="number"
        name="quantity"
        min="0"
        defaultValue={quantity}
        aria-label="Stock"
        style={{
          width: 80,
          padding: '6px 10px',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          font: 'inherit',
          fontSize: '0.82rem',
        }}
      />
      <input
        type="number"
        name="lowStockThreshold"
        min="0"
        defaultValue={lowStockThreshold}
        aria-label="Umbral de stock bajo"
        style={{
          width: 70,
          padding: '6px 10px',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          font: 'inherit',
          fontSize: '0.82rem',
        }}
      />
      <SubmitButton className="btn btn-outline btn-sm">Ajustar</SubmitButton>
      {state.status === 'success' ? <span className="tag tag-success">✓</span> : null}
      {state.status === 'error' ? <span className="tag tag-danger">!</span> : null}
    </form>
  );
}
