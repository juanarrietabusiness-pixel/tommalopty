import { describe, expect, it } from 'vitest';
import { availableQuantity, canFulfill, stockLevel, type InventoryState } from './stock';

function inventario(overrides: Partial<InventoryState> = {}): InventoryState {
  return {
    quantity: 10,
    reservedQuantity: 0,
    trackInventory: true,
    allowBackorder: false,
    lowStockThreshold: 5,
    ...overrides,
  };
}

describe('disponibilidad de inventario', () => {
  it('descuenta las unidades reservadas en pedidos sin cumplir', () => {
    expect(availableQuantity(inventario({ quantity: 10, reservedQuantity: 4 }))).toBe(6);
  });

  it('no devuelve disponibilidad negativa aunque la reserva supere el stock', () => {
    expect(availableQuantity(inventario({ quantity: 2, reservedQuantity: 5 }))).toBe(0);
  });

  it('trata como ilimitado lo que no controla inventario', () => {
    expect(canFulfill(inventario({ trackInventory: false, quantity: 0 }), 999)).toBe(true);
  });

  it('rechaza vender más de lo disponible', () => {
    expect(canFulfill(inventario({ quantity: 3, reservedQuantity: 1 }), 3)).toBe(false);
    expect(canFulfill(inventario({ quantity: 3, reservedQuantity: 1 }), 2)).toBe(true);
  });

  it('permite pedidos pendientes si la variante acepta backorder', () => {
    expect(canFulfill(inventario({ quantity: 0, allowBackorder: true }), 5)).toBe(true);
  });

  it('rechaza cantidades cero o negativas', () => {
    expect(canFulfill(inventario(), 0)).toBe(false);
    expect(canFulfill(inventario(), -1)).toBe(false);
  });

  it('clasifica el nivel de stock para el aviso de la ficha', () => {
    expect(stockLevel(inventario({ quantity: 20 }))).toBe('in_stock');
    expect(stockLevel(inventario({ quantity: 3 }))).toBe('low_stock');
    expect(stockLevel(inventario({ quantity: 0 }))).toBe('out_of_stock');
  });
});
