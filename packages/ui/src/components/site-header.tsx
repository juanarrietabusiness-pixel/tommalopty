'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '../cart/cart-context';
import { CartDrawer } from './cart-drawer';
import { MobileNav } from './mobile-nav';
import { AnnouncementBar, type AnnouncementBarProps } from './announcement-bar';
import { CartIcon, LogoMark, MenuIcon, SearchIcon, UserIcon } from './icons';

export interface NavItem {
  label: string;
  href: string;
}

export interface SiteHeaderProps {
  brandName: string;
  navItems: NavItem[];
  announcement?: AnnouncementBarProps | null;
  accountHref?: string;
}

export function SiteHeader({
  brandName,
  navItems,
  announcement,
  accountHref = '/cuenta',
}: SiteHeaderProps) {
  const { count, openCart, closeCart, isOpen: isCartOpen, isHydrated } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const overlayOpen = isCartOpen || isMenuOpen;

  function closeAll() {
    closeCart();
    setIsMenuOpen(false);
  }

  return (
    <>
      <header className="site-header">
        <div className="container header-row">
          <button
            type="button"
            className="hamburger icon-btn"
            onClick={() => setIsMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <MenuIcon />
          </button>

          <Link href="/" className="logo">
            <LogoMark />
            <span>{brandName.toUpperCase()}</span>
          </Link>

          <nav className="main-nav" aria-label="Navegación principal">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            <Link href="/buscar" className="icon-btn" aria-label="Buscar">
              <SearchIcon />
            </Link>
            <Link href={accountHref} className="icon-btn" aria-label="Mi cuenta">
              <UserIcon />
            </Link>
            <button type="button" className="icon-btn" onClick={openCart} aria-label="Abrir carrito">
              <CartIcon />
              {/* Hasta rehidratar mostramos 0 para no provocar desajuste de SSR. */}
              <span className="cart-count">{isHydrated ? count : 0}</span>
            </button>
          </div>
        </div>

        {announcement ? <AnnouncementBar {...announcement} /> : null}
      </header>

      <div
        className={`overlay${overlayOpen ? ' is-open' : ''}`}
        onClick={closeAll}
        aria-hidden="true"
      />
      <CartDrawer />
      <MobileNav items={navItems} isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  );
}
