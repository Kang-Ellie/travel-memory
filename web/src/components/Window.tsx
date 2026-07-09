import type { ReactNode } from 'react'

interface WindowProps {
  title: string
  color?: 'pink' | 'blue' | 'purple' | 'green' | 'yellow'
  onClose?: () => void
  children: ReactNode
  footer?: ReactNode
}

export default function Window({ title, color = 'pink', onClose, children, footer }: WindowProps) {
  return (
    <div className="window">
      <div className={`window-titlebar ${color === 'pink' ? '' : color}`}>
        <div className="dots">
          <span className="dot r" />
          <span className="dot y" />
          <span className="dot g" />
        </div>
        <span className="window-title">{title}</span>
        {onClose && (
          <button className="window-close" onClick={onClose} title="닫기">×</button>
        )}
      </div>
      <div className="window-body">{children}</div>
      {footer}
    </div>
  )
}
