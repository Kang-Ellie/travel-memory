import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react'

interface Option {
  value: string
  label: ReactNode
  disabled?: boolean
}

// 네이티브 <select>와 동일한 value/onChange/<option> children API를 흉내내서,
// 기존 코드는 태그명만 <select>→<Select>로 바꾸면 그대로 동작하도록 만든 커스텀 드롭다운.
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
  const ref = useRef<HTMLDivElement>(null)

  const options: Option[] = []
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === 'option') {
      const p = child.props as { value?: string; children?: ReactNode; disabled?: boolean }
      options.push({ value: p.value != null ? String(p.value) : '', label: p.children, disabled: p.disabled })
    }
  })

  useEffect(() => {
    if (!open) return
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
  }, [open])

  const selected = options.find((o) => o.value === value)

  return (
    <div className="cselect" ref={ref} style={style}>
      <button
        type="button"
        className={`cselect-trigger ${disabled ? 'disabled' : ''}`}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cselect-value">{selected ? selected.label : (placeholder ?? ' ')}</span>
        <span className="cselect-arrow">▾</span>
      </button>
      {open && (
        <div className="cselect-menu">
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
        </div>
      )}
    </div>
  )
}
