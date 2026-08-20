'use client';

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number | null;
  label?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = null,
  label = 'Cantidad',
}: QuantityStepperProps) {
  const canDecrease = value > min;
  const canIncrease = max === null || value < max;

  return (
    <div className="qty-stepper">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={!canDecrease}
        aria-label="Reducir cantidad"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max ?? undefined}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={!canIncrease}
        aria-label="Aumentar cantidad"
      >
        +
      </button>
    </div>
  );
}
