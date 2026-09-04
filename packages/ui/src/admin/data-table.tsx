import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
}

export function DataTable<T>({ columns, rows, rowKey, emptyMessage }: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="table-wrap">
        <div className="empty-state">
          <p>{emptyMessage ?? 'Todavía no hay registros.'}</p>
        </div>
      </div>
    );
  }

  return (
    // `tabIndex` y `role="region"` porque esta caja se desplaza a lo ancho: en
    // un teléfono una tabla ancha no cabe y `overflow-x: auto` la deja rodar.
    // Sin foco, quien navega con teclado no puede moverla y las columnas de la
    // derecha son inalcanzables. Lo cazó la auditoría del panel (#50).
    //
    // El nombre accesible es obligatorio en una región; sin él, un lector de
    // pantalla anuncia «región» y no dice de qué.
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de datos">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align === 'right' ? 'num' : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.align === 'right' ? 'num' : undefined}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
