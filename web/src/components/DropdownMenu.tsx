import { useEffect, useRef, useState } from 'react'

export interface MenuAction {
  label: string
  onClick: () => void
  danger?: boolean
}

export default function DropdownMenu({ actions }: { actions: Array<MenuAction | 'divider'> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div className="event-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="event-menu-trigger" onClick={() => setOpen((v) => !v)} title="더보기">⋮</button>
      {open && (
        <div className="event-menu-panel">
          {actions.map((a, i) => (
            a === 'divider' ? (
              <div key={i} className="menu-divider" />
            ) : (
              <button
                key={i}
                type="button"
                className={a.danger ? 'danger' : undefined}
                onClick={() => { a.onClick(); setOpen(false) }}
              >
                {a.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  )
}
