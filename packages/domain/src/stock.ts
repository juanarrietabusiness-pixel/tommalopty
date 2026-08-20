/**
 * Reglas de disponibilidad de inventario.
 *
 * "Disponible" nunca es `quantity` a secas: hay unidades comprometidas en
 * pedidos que aún no se han cumplido, y venderlas otra vez significa cancelarle
 * la compra a alguien.
 */

export interface InventoryState {
  quantity: number;
  reservedQuantity: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  lowStockThreshold: number;
}

export function availableQuantity(inventory: InventoryState): number {
  if (!inventory.trackInventory) return Number.POSITIVE_INFINITY;
  return Math.max(inventory.quantity - inventory.reservedQuantity, 0);
}

export function canFulfill(inventory: InventoryState, requested: number): boolean {
  if (requested <= 0) return false;
  if (!inventory.trackInventory) return true;
  if (inventory.allowBackorder) return true;
  return availableQuantity(inventory) >= requested;
}

export type StockLevel = 'in_stock' | 'low_stock' | 'out_of_stock';

export function stockLevel(inventory: InventoryState): StockLevel {
  if (!inventory.trackInventory) return 'in_stock';

  const available = availableQuantity(inventory);
  if (available <= 0) return inventory.allowBackorder ? 'low_stock' : 'out_of_stock';
  if (available <= inventory.lowStockThreshold) return 'low_stock';
  return 'in_stock';
}
