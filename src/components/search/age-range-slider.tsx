"use client";

export const AGE_MIN = 18;
export const AGE_MAX = 99;

const THUMB_CLASS =
  "range-thumb pointer-events-none absolute inset-0 h-6 w-full cursor-pointer appearance-none bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 " +
  "[&::-webkit-slider-thumb]:border-teal2 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 " +
  "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 " +
  "[&::-moz-range-thumb]:border-teal2 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow";

export function AgeRangeSlider({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  const minPercent = ((min - AGE_MIN) / (AGE_MAX - AGE_MIN)) * 100;
  const maxPercent = ((max - AGE_MIN) / (AGE_MAX - AGE_MIN)) * 100;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-text">
        <span>{min}</span>
        <span>
          {max}
          {max === AGE_MAX ? "+" : ""}
        </span>
      </div>
      <div className="relative h-5">
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{
            left: `${minPercent}%`,
            right: `${100 - maxPercent}%`,
            backgroundImage: "var(--grad)",
          }}
        />
        <input
          type="range"
          min={AGE_MIN}
          max={AGE_MAX}
          value={min}
          onChange={(e) => onChange(Math.min(Number(e.target.value), max), max)}
          className={THUMB_CLASS}
        />
        <input
          type="range"
          min={AGE_MIN}
          max={AGE_MAX}
          value={max}
          onChange={(e) => onChange(min, Math.max(Number(e.target.value), min))}
          className={THUMB_CLASS}
        />
      </div>
    </div>
  );
}
