/**
 * Gráfico de barras sin dependencias externas.
 * Suficiente para los reportes del MVP; sustituible por una librería de charts
 * si el equipo necesita series múltiples o interacción avanzada.
 */
export interface BarChartPoint {
  label: string;
  value: number;
}

export function BarChart({
  points,
  formatValue,
}: {
  points: BarChartPoint[];
  formatValue?: (value: number) => string;
}) {
  if (points.length === 0) {
    return (
      <div className="empty-state">
        <p>Sin datos en el periodo seleccionado.</p>
      </div>
    );
  }

  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <div className="bar-chart">
      {points.map((point, index) => (
        <div className="bar-chart-col" key={`${point.label}-${index}`}>
          {/*
            La barra necesita una pista con altura propia contra la que resolver
            su porcentaje. Sin ella, `height: 60%` se calcula sobre una altura
            indefinida —la columna se dimensiona por su contenido— y todas las
            barras colapsan al `min-height`. El gráfico salía vacío con
            cualquier dato.
          */}
          <div className="bar-chart-track">
            <div
              className="bar-chart-bar"
              style={{ height: `${Math.max((point.value / max) * 100, 1)}%` }}
              title={`${point.label}: ${formatValue ? formatValue(point.value) : point.value}`}
            />
          </div>
          <span className="bar-chart-label">{point.label}</span>
        </div>
      ))}
    </div>
  );
}
