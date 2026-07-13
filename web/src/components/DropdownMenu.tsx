import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface MenuAction {
  label: string
  onClick: () => void
  danger?: boolean
}

interface MenuPos { top: number; left: number }

// 카드 안에 있는 ⋮ 메뉴는 카드의 overflow:hidden에 의해 잘릴 수 있어서,
// Select/DatePicker와 동일하게 패널을 포털로 body에 fixed 배치한다.
export default function DropdownMenu({ actions }: { actions: Array<MenuAction | 'divider'> }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<MenuPos | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const openMenu = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const panelWidth = 180
    const left = Math.min(r.right - panelWidth, window.innerWidth - panelWidth - 8)
    setPos({ top: r.bottom + 4, left: Math.max(8, left) })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    window.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <div className="event-menu" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className="event-menu-trigger"
        onClick={() => (open ? setOpen(false) : openMenu())}
        title="더보기"
      >
        ⋮
      </button>
      {open && pos && createPortal(
        <div ref={panelRef} className="event-menu-panel" style={{ position: 'fixed', top: pos.top, left: pos.left }}>
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
        </div>,
        document.body,
      )}
    </div>
  )
}
