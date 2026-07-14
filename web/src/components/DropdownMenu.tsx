import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface MenuAction {
  label: string
  onClick: () => void
  danger?: boolean
}

interface MenuPos { top: number; right: number }

// 카드 안에 있는 ⋮ 메뉴는 카드의 overflow:hidden에 의해 잘릴 수 있어서,
// Select/DatePicker와 동일하게 패널을 포털로 body에 fixed 배치한다.
// 패널은 트리거의 오른쪽 끝에 right로 고정해서, 항목 텍스트 길이에 맞춰 폭이
// 자동으로 정해지게 한다(고정 min-width로 짧은 메뉴가 쓸데없이 커지는 것 방지).
export default function DropdownMenu({ actions, icon = '⋮', title = '더보기' }: {
  actions: Array<MenuAction | 'divider'>
  icon?: string
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<MenuPos | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const openMenu = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) })
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
        title={title}
      >
        {icon}
      </button>
      {open && pos && createPortal(
        <div ref={panelRef} className="event-menu-panel" style={{ position: 'fixed', top: pos.top, right: pos.right }}>
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
