// A tiny line of active members over time (oldest left), no library.

export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return <p className="text-sm text-muted">Servono almeno due rilevazioni.</p>;
  const w = 320;
  const h = 64;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 4 - ((v - min) / span) * (h - 8)).toFixed(1)}`)
    .join(" ");
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full max-w-md" role="img" aria-label={label}>
        <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <figcaption className="mt-1 text-xs text-muted">
        {label}: da {values[0]} a {values[values.length - 1]} (min {min}, max {max})
      </figcaption>
    </figure>
  );
}
