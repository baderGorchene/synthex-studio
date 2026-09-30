'use client';

import { useId } from 'react';

/** A line-width slider with a live stroke preview drawn in the current colour. */
export function WidthSlider({ label, value, min, max, step, color, opacity = 1, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  color: string;
  opacity?: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const shown = Math.min(value, 26); // the preview box is 30px tall
  return (
    <div className="width-slider">
      <div className="width-slider-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{Number.isInteger(value) ? value : value.toFixed(1)} px</output>
      </div>
      <svg className="width-slider-preview" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 8 18 C 30 6, 52 26, 74 14 S 104 10, 112 16" fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={shown} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        style={{ ['--fill' as `--${string}`]: `${((value - min) / (max - min)) * 100}%` }}
      />
    </div>
  );
}
