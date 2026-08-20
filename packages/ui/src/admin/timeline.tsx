import { dateTime } from '../lib/format';

export interface TimelineEntry {
  id: string;
  message: string;
  createdAt: string;
}

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="field-hint">Sin actividad registrada.</p>;
  }

  return (
    <div className="timeline">
      {entries.map((entry) => (
        <div className="timeline-item" key={entry.id}>
          <span className="timeline-dot" />
          <div className="timeline-body">
            <p>{entry.message}</p>
            <time dateTime={entry.createdAt}>{dateTime(entry.createdAt)}</time>
          </div>
        </div>
      ))}
    </div>
  );
}
