interface MetricCardProps {
  label: string
  value: string | number
  subtitle?: string
}

export function MetricCard({ label, value, subtitle }: MetricCardProps) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-medium tracking-tight tabular-nums">
        {value}
      </p>
      {subtitle ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}
