import { useId } from "react";
import type { InputHTMLAttributes } from "react";

type NumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "type" | "value"
> & {
  label: string;
  onValueChange: (value: string) => void;
  value: number | string;
};

const numericValue = (value: number | string | undefined) => {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function NumberInput({
  label,
  max,
  min,
  onValueChange,
  step,
  value,
  ...inputProps
}: NumberInputProps) {
  const currentValue = numericValue(value);
  const minValue = numericValue(min);
  const maxValue = numericValue(max);
  const stepValue = numericValue(step) ?? 1;
  const atMinimum =
    currentValue !== undefined &&
    minValue !== undefined &&
    currentValue <= minValue;
  const atMaximum =
    currentValue !== undefined &&
    maxValue !== undefined &&
    currentValue >= maxValue;

  const changeByStep = (direction: -1 | 1) => {
    const nextValue = (currentValue ?? 0) + direction * stepValue;
    const boundedValue = Math.max(
      minValue ?? Number.NEGATIVE_INFINITY,
      Math.min(maxValue ?? Number.POSITIVE_INFINITY, nextValue),
    );
    const precision = Math.min(
      10,
      Math.max(
        ...[stepValue, currentValue, minValue, maxValue]
          .filter((number): number is number => number !== undefined)
          .map((number) => number.toString().split(".")[1]?.length ?? 0),
      ),
    );
    onValueChange(String(Number(boundedValue.toFixed(precision))));
  };

  return (
    <div className="number-input">
      <input
        {...inputProps}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onValueChange(event.currentTarget.value)}
      />
      <button
        className="number-input-stepper"
        type="button"
        aria-label={`${label} verringern`}
        disabled={atMinimum}
        onClick={() => changeByStep(-1)}
      >
        −
      </button>
      <button
        className="number-input-stepper"
        type="button"
        aria-label={`${label} erhöhen`}
        disabled={atMaximum}
        onClick={() => changeByStep(1)}
      >
        +
      </button>
    </div>
  );
}

export function NumberField(props: NumberInputProps) {
  const id = useId();
  return (
    <div className="field number-field">
      <label htmlFor={id}>{props.label}</label>
      <NumberInput {...props} id={id} />
    </div>
  );
}
