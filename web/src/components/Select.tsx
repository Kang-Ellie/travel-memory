import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Option {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface MenuPos {
  top: number
  left: number
  width: number
}

// 네이티브 <select>와 동일한 value/onChange/<option> children API를 흉내내서,
// 기존 코드는 태그명만 <select>→<Select>로 바꾸면 그대로 동작하도록 만든 커스텀 드롭다운.
// 메뉴는 포털로 body에 fixed 배치해서 모달처럼 스크롤되는 조상 안에서도 잘리지 않게 한다.
export default function Select({
  value, onChange, children, placeholder, style, disabled,
}: {
  value: string
  onChange: (e: { target: { value: string } }) => void
  children: ReactNode
  placeholder?: string
  style?: React.CSSProperties
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<MenuPos | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const options: Option[] = []
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === 'option') {
      const p = child.props as { value?: string; children?: ReactNode; disabled?: boolean }
      options.push({ value: p.value != null ? String(p.value) : '', label: p.children, disabled: p.disabled })
    }
  })

  const openMenu = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.max(r.width, 160)
    const left = Math.min(r.left, window.innerWidth - width - 8)
    setPos({ top: r.bottom + 4, left: Math.max(8, left), width })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    // 메뉴 내부 스크롤(옵션 목록을 훑어보는 것)까지 닫아버리지 않도록, 메뉴 안에서 난 스크롤은 무시한다.
    const closeOnOutsideScroll = (e: Event) => {
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    window.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', closeOnOutsideScroll, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', closeOnOutsideScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const selected = options.find((o) => o.value === value)

  return (
    <div className="cselect" style={style}>
      <button
        ref={triggerRef}
        type="button"
        className={`cselect-trigger ${disabled ? 'disabled' : ''}`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <span className="cselect-value">{selected ? selected.label : (placeholder ?? ' ')}</span>
        <span className="cselect-arrow">▾</span>
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="cselect-menu"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, minWidth: pos.width }}
        >
          {options.map((o, i) => (
            <div
              key={`${o.value}-${i}`}
              className={`cselect-option ${o.value === value ? 'active' : ''} ${o.disabled ? 'disabled' : ''}`}
              onClick={() => {
                if (o.disabled) return
                onChange({ target: { value: o.value } })
                setOpen(false)
              }}
            >
              {o.label}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
