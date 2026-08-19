import type { ReactNode } from 'react';
import { ImagePlaceholderIcon } from './icons';

export function EmptyState({
  message,
  icon,
  action,
}: {
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon ?? <ImagePlaceholderIcon />}
      <p>{message}</p>
      {action}
    </div>
  );
}
