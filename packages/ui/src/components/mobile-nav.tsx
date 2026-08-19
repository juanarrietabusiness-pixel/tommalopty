'use client';

import Link from 'next/link';
import { CloseIcon } from './icons';
import type { NavItem } from './site-header';

export interface MobileNavProps {
  items: NavItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ items, isOpen, onClose }: MobileNavProps) {
  return (
    <nav
      className={`mobile-nav${isOpen ? ' is-open' : ''}`}
      aria-hidden={!isOpen}
      aria-label="Navegación móvil"
    >
      <button
        type="button"
        className="icon-btn close-btn"
        onClick={onClose}
        aria-label="Cerrar menú"
      >
        <CloseIcon />
      </button>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} onClick={onClose}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
