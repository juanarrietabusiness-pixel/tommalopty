'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';

/**
 * Estado del carrito en cliente.
 *
 * Persiste en localStorage para que el carrito sobreviva a recargas sin exigir
 * cuenta. Cuando la persona inicia sesión, el storefront sincroniza estas líneas
 * con la tabla `carts` a través de un Route Handler (el token de invitado no es
 * una credencial que RLS pueda verificar, por eso la escritura pasa por servidor).
 */
export interface CartLine {
  variantId: string;
  productId: string;
  slug: string;
  title: string;
  variantTitle?: string | null;
  price: number;
  compareAtPrice?: number | null;
  imageUrl?: string | null;
  quantity: number;
  /** Stock disponible; `null` si la variante no controla inventario. */
  maxQuantity?: number | null;
}

type CartAction =
  | { type: 'add'; line: CartLine }
  | { type: 'remove'; variantId: string }
  | { type: 'setQuantity'; variantId: string; quantity: number }
  | { type: 'replace'; lines: CartLine[] }
  | { type: 'clear' };

const STORAGE_KEY = 'nebula.cart.v1';

function clampToStock(quantity: number, max: number | null | undefined): number {
  const positive = Math.max(1, Math.trunc(quantity));
  if (max === null || max === undefined) return positive;
  return Math.min(positive, Math.max(max, 0));
}

function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add': {
      const existing = state.find((line) => line.variantId === action.line.variantId);
      if (!existing) {
        return [...state, { ...action.line, quantity: clampToStock(action.line.quantity, action.line.maxQuantity) }];
      }
      return state.map((line) =>
        line.variantId === action.line.variantId
          ? { ...line, quantity: clampToStock(line.quantity + action.line.quantity, line.maxQuantity) }
          : line,
      );
    }
    case 'remove':
      return state.filter((line) => line.variantId !== action.variantId);
    case 'setQuantity': {
      if (action.quantity <= 0) {
        return state.filter((line) => line.variantId !== action.variantId);
      }
      return state.map((line) =>
        line.variantId === action.variantId
          ? { ...line, quantity: clampToStock(action.quantity, line.maxQuantity) }
          : line,
      );
    }
    case 'replace':
      return action.lines;
    case 'clear':
      return [];
    default:
      return state;
  }
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  isHydrated: boolean;
  addLine: (line: CartLine) => void;
  removeLine: (variantId: string) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, dispatch] = useReducer(cartReducer, [] as CartLine[]);
  const [isOpen, setIsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Rehidratación en cliente: evita desajustes entre SSR y navegador.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          dispatch({ type: 'replace', lines: parsed as CartLine[] });
        }
      }
    } catch {
      // Un localStorage corrupto o bloqueado no debe romper la tienda.
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Modo privado / cuota agotada: el carrito sigue funcionando en memoria.
    }
  }, [lines, isHydrated]);

  const addLine = useCallback((line: CartLine) => {
    dispatch({ type: 'add', line });
    setIsOpen(true);
  }, []);

  const removeLine = useCallback((variantId: string) => {
    dispatch({ type: 'remove', variantId });
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    dispatch({ type: 'setQuantity', variantId, quantity });
  }, []);

  const clear = useCallback(() => dispatch({ type: 'clear' }), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.price, 0);
    return {
      lines,
      count,
      subtotal: Math.round(subtotal * 100) / 100,
      isOpen,
      isHydrated,
      addLine,
      removeLine,
      setQuantity,
      clear,
      openCart,
      closeCart,
    };
  }, [lines, isOpen, isHydrated, addLine, removeLine, setQuantity, clear, openCart, closeCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe usarse dentro de <CartProvider>.');
  }
  return context;
}
