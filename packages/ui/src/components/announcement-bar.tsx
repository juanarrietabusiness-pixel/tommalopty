/**
 * Barra de promoción superior. El contenido llega del CMS
 * (`cms_banners` con placement = 'announcement_bar').
 */
export interface AnnouncementBarProps {
  eyebrow?: string | null;
  title?: string | null;
  subtitle?: string | null;
}

export function AnnouncementBar({ eyebrow, title, subtitle }: AnnouncementBarProps) {
  if (!eyebrow && !title && !subtitle) return null;

  return (
    <div className="announcement-bar">
      <div className="container">
        {eyebrow ? <span className="pill">{eyebrow}</span> : null}
        {title ? (
          <span>
            <strong>{title}</strong>
          </span>
        ) : null}
        {title && subtitle ? <span className="dot">·</span> : null}
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
    </div>
  );
}
