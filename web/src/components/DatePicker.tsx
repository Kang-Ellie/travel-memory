import { useEffect, useRef, useState } from 'react'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function pad(n: number): string { return String(n).padStart(2, '0') }
function toISO(y: number, m: number, d: number): string { return `${y}-${pad(m + 1)}-${pad(d)}` }
function parseISO(v: string): Date | null {
  if (!v) return null
  const d = new Date(v + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

export default function DatePicker({
  value, onChange, style,
}: { value: string; onChange: (e: { target: { value: string } }) => void; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => (parseISO(value) ?? new Date()).getFullYear())
  const [viewMonth, setViewMonth] = useState(() => (parseISO(value) ?? new Date()).getMonth())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const d = parseISO(value) ?? new Date()
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const shiftMonth = (delta: number) => {
    let y = viewYear
    let m = viewMonth + delta
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setViewYear(y); setViewMonth(m)
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const pick = (day: number) => {
    onChange({ target: { value: toISO(viewYear, viewMonth, day) } })
    setOpen(false)
  }

  return (
    <div className="cdate" ref={ref} style={style}>
      <button type="button" className="cdate-trigger" onClick={() => setOpen((v) => !v)}>
        <span>{value || '날짜 선택'}</span>
        <span>📅</span>
      </button>
      {open && (
        <div className="cdate-panel">
          <div className="cdate-head">
            <button type="button" className="cdate-nav" onClick={() => shiftMonth(-1)}>‹</button>
            <span>{viewYear}.{pad(viewMonth + 1)}</span>
            <button type="button" className="cdate-nav" onClick={() => shiftMonth(1)}>›</button>
          </div>
          <div className="cdate-grid">
            {WEEKDAYS.map((w) => <span key={w} className="cdate-weekday">{w}</span>)}
            {cells.map((day, i) => (
              <button
                type="button"
                key={i}
                className={`cdate-cell ${day != null && value === toISO(viewYear, viewMonth, day) ? 'active' : ''}`}
                disabled={day == null}
                onClick={() => day != null && pick(day)}
              >
                {day ?? ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
