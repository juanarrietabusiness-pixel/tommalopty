'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '../cart/cart-context';
import { money } from '../lib/format';
import { CartIcon, CloseIcon } from './icons';

/**
 * Drawer lateral del carrito. El botón de finalizar compra lleva a /checkout,
 * donde se elige pasarela: el carrito no conoce ninguna integración de pago.
 */
export function CartDrawer() {
  const { lines, subtotal, isOpen, closeCart, removeLine, setQuantity } = useCart();

  // Cerrar con Escape es lo mínimo esperable en un panel modal.
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeCart();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeCart]);

  return (
    <aside
      className={`cart-drawer${isOpen ? ' is-open' : ''}`}
      // `inert` saca todo el panel del foco y del árbol de accesibilidad cuando
      // está cerrado. `aria-hidden` por sí solo no impide tabular dentro.
      inert={!isOpen}
      aria-label="Tu carrito"
    >
      <div className="drawer-header">
        <h2>Tu carrito</h2>
        <button type="button" className="icon-btn" onClick={closeCart} aria-label="Cerrar carrito">
          <CloseIcon />
        </button>
      </div>

      <div className="drawer-body">
        {lines.length === 0 ? (
          <div className="drawer-empty">
            <CartIcon strokeWidth={1.4} />
            <p>
              Tu carrito está vacío.
              <br />
              Añade productos para verlos aquí.
            </p>
          </div>
        ) : (
          lines.map((line) => (
            <div className="cart-line" key={line.variantId}>
              <div className="thumb">
                {line.imageUrl ? (
                  // <img> deliberado: dominios de media configurables por entorno.
                  <img src={line.imageUrl} alt="" />
                ) : null}
              </div>
              <div className="info">
                <p>
                  <Link href={`/producto/${line.slug}`} onClick={closeCart}>
                    {line.title}
                  </Link>
                </p>
                <span>
                  {line.quantity} × {money(line.price)}
                </span>
                <div className="qty-stepper" style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                    aria-label={`Quitar una unidad de ${line.title}`}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={line.quantity}
                    min={1}
                    onChange={(event) => setQuantity(line.variantId, Number(event.target.value))}
                    aria-label={`Cantidad de ${line.title}`}
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                    aria-label={`Añadir una unidad de ${line.title}`}
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="cart-line-remove"
                onClick={() => removeLine(line.variantId)}
              >
                Quitar
              </button>
            </div>
          ))
        )}
      </div>

      <div className="drawer-footer">
        <div className="subtotal">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        <Link
          href="/checkout"
          className="btn btn-dark"
          style={{ width: '100%' }}
          onClick={closeCart}
          aria-disabled={lines.length === 0}
        >
          Finalizar compra
        </Link>
      </div>
    </aside>
  );
}
