'use client'

export function PanelSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
        <span className="text-xs text-foreground tabular-nums font-medium">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-surface-hover rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">{min}</span>
        <span className="text-[10px] text-muted-foreground">{max}</span>
      </div>
    </div>
  )
}
