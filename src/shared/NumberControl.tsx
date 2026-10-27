import { useState } from 'react'
export function NumberControl({ label, value, onChange, min = -1e6, max = 1e6 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  const [draft, setDraft] = useState<string | null>(null)
  const invalid = draft !== null && (!draft.trim() || !Number.isFinite(Number(draft)) || Number(draft) < min || Number(draft) > max)
  return <label className="number-label">{label}<input type="number" step="any" min={min} max={max} value={draft ?? value} aria-invalid={invalid} onChange={event => {
    const text = event.target.value, n = Number(text); setDraft(text)
    if (text.trim() && Number.isFinite(n) && n >= min && n <= max) onChange(n)
  }} onBlur={() => setDraft(null)} />{invalid && <span className="input-error">Rango: {min} a {max}. Se conserva el valor anterior.</span>}</label>
}
