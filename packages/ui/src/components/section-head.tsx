import Link from 'next/link';

export interface SectionHeadProps {
  title: string;
  linkLabel?: string;
  linkHref?: string;
}

export function SectionHead({ title, linkLabel, linkHref }: SectionHeadProps) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {linkLabel && linkHref ? (
        <Link href={linkHref} className="link-view-all">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
