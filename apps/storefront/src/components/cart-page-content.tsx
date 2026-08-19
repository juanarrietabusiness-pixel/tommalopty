'use client';

import Link from 'next/link';
import { EmptyState, QuantityStepper, money, useCart } from '@nebula/ui';

/** Página de carrito completa (además del drawer lateral). */
export function CartPageContent() {
  const { lines, subtotal, setQuantity, removeLine, isHydrated } = useCart();

  if (!isHydrated) {
    return <p className="field-hint">Cargando tu carrito…</p>;
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        message="Tu carrito está vacío."
        action={
          <Link href="/tienda" className="btn btn-dark btn-sm">
            Ir a la tienda
          </Link>
        }
      />
    );
  }

  return (
    <div className="cart-layout">
      <div>
        <table className="cart-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.variantId}>
                <td>
                  <div className="cart-product">
                    <div className="thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {line.imageUrl ? <img src={line.imageUrl} alt="" /> : null}
                    </div>
                    <div>
                      <Link href={`/producto/${line.slug}`} style={{ fontWeight: 600 }}>
                        {line.title}
                      </Link>
                      {line.variantTitle ? (
                        <div className="field-hint">{line.variantTitle}</div>
                      ) : null}
                      <div className="field-hint">{money(line.price)} c/u</div>
                    </div>
                  </div>
                </td>
                <td>
                  <QuantityStepper
                    value={line.quantity}
                    onChange={(value) => setQuantity(line.variantId, value)}
                    max={line.maxQuantity ?? null}
                  />
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  {money(line.price * line.quantity)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="cart-line-remove"
                    onClick={() => removeLine(line.variantId)}
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <aside className="summary-card">
        <h2>Resumen</h2>
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        <div className="summary-row">
          <span>Envío</span>
          <span>Se calcula en el checkout</span>
        </div>
        <div className="summary-row total">
          <span>Total</span>
          <span>{money(subtotal)}</span>
        </div>
        <Link href="/checkout" className="btn btn-dark" style={{ width: '100%', marginTop: 18 }}>
          Finalizar compra
        </Link>
        <Link
          href="/tienda"
          className="btn btn-outline btn-sm"
          style={{ width: '100%', marginTop: 10 }}
        >
          Seguir comprando
        </Link>
      </aside>
    </div>
  );
}
