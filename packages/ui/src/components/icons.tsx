import type { SVGProps } from 'react';

/**
 * Set de iconos del esqueleto original + los necesarios para el panel.
 * Todos heredan `currentColor` y el tamaño se controla desde CSS.
 */
type IconProps = SVGProps<SVGSVGElement>;

const stroke: IconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  'aria-hidden': true,
};

const strokeThin: IconProps = { ...stroke, strokeWidth: 1.6 };

export function LogoMark(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <path d="M12 2c3 3 3 6 1 8-2-1-4-1-5 1-1 2 0 4 2 5-3 1-6-1-7-4-1-4 2-9 9-10Z" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path
        d="M3 6h2l2.4 12.2a2 2 0 0 0 2 1.8h8.2a2 2 0 0 0 2-1.6L21 8H6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="21" r="1" />
      <circle cx="17" cy="21" r="1" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <path d="M3 7h13l3 5v6h-3M3 7v10h3M16 12H3M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3Z" />
    </svg>
  );
}

export function ReturnIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
    </svg>
  );
}

export function ImagePlaceholderIcon(props: IconProps) {
  return (
    <svg {...stroke} strokeWidth={1.4} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M13.5 21v-7.5H16l.4-3H13.5V8.4c0-.87.24-1.46 1.5-1.46H16.5V4.35C16.2 4.3 15.2 4.2 14 4.2c-2.4 0-4 1.46-4 4.15v2.15H7.5v3H10V21h3.5Z" />
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" />
    </svg>
  );
}

export function TikTokIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M14 3c.4 2.2 2 3.7 4.2 4v2.9c-1.5.1-2.9-.4-4.2-1.3v6.6a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v2.9a2.8 2.8 0 1 0 2 2.7V3h2.8Z" />
    </svg>
  );
}

/* --- Iconos del panel administrativo -------------------------------------- */

export function DashboardIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

export function BoxIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </svg>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M18 20a6 6 0 0 0-3-5.2" />
    </svg>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-3-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-3l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 3 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

export function ReceiptIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5" />
      <path d="M9 9h6M9 13h6" />
    </svg>
  );
}

export function MegaphoneIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z" />
      <path d="M14 8a5 5 0 0 1 0 8M17 5a9 9 0 0 1 0 14" strokeLinecap="round" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <path
        d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...strokeThin} {...props}>
      <path d="M12 3 2 20h20L12 3Z" strokeLinejoin="round" />
      <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}
