import Link from 'next/link';
import { FacebookIcon, InstagramIcon, LogoMark, TikTokIcon } from './icons';
import type { NavItem } from './site-header';

export interface FooterColumn {
  title: string;
  items: NavItem[];
}

export interface SiteFooterProps {
  brandName: string;
  description?: string | null;
  columns: FooterColumn[];
  social?: { facebook?: string; instagram?: string; tiktok?: string };
  legalHref?: string;
}

export function SiteFooter({
  brandName,
  description,
  columns,
  social,
  legalHref = '/p/terminos',
}: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="logo" style={{ color: '#fff' }}>
              <LogoMark />
              <span>{brandName.toUpperCase()}</span>
            </div>
            {description ? <p>{description}</p> : null}
            <div className="social-row">
              {social?.facebook ? (
                <a
                  href={social.facebook}
                  aria-label="Facebook"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  <FacebookIcon />
                </a>
              ) : null}
              {social?.instagram ? (
                <a
                  href={social.instagram}
                  aria-label="Instagram"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  <InstagramIcon />
                </a>
              ) : null}
              {social?.tiktok ? (
                <a
                  href={social.tiktok}
                  aria-label="TikTok"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  <TikTokIcon />
                </a>
              ) : null}
            </div>
          </div>

          {columns.map((column) => (
            <div className="footer-col" key={column.title}>
              <h3>{column.title}</h3>
              <ul>
                {column.items.map((item) => (
                  <li key={`${column.title}-${item.href}`}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <span>
            © {year} {brandName}
          </span>
          <Link href={legalHref}>Términos y políticas</Link>
        </div>
      </div>
    </footer>
  );
}
