import { useEffect, useState } from 'react'
import { toast, type ToastItem } from '../toast'

const ICON: Record<ToastItem['kind'], string> = { success: '✅', error: '⚠️', info: 'ℹ️' }

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => toast.subscribe(setItems), [])

  if (items.length === 0) return null
  return (
    <div className="toast-host">
      {items.map((t) => (
        <div key={t.id} className={`toast-item toast-${t.kind}`} role="status" onClick={() => toast.dismiss(t.id)}>
          <span className="toast-icon">{ICON[t.kind]}</span>
          <span className="toast-msg">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
