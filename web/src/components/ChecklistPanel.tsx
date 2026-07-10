import { useEffect, useState } from 'react'
import type { ChecklistScope, ChecklistItem } from '../../shared/types'
import { api } from '../api'

export default function ChecklistPanel({
  tripId, scope, dayNumber, title, addPlaceholder,
}: {
  tripId: string
  scope: ChecklistScope
  dayNumber?: number
  title: string
  addPlaceholder: string
}) {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [text, setText] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const refresh = () => { api.checklist.list(tripId, scope, dayNumber).then(setItems) }
  useEffect(refresh, [tripId, scope, dayNumber])

  const add = async () => {
    if (!text.trim()) return
    await api.checklist.create({ tripId, scope, dayNumber: dayNumber ?? null, text: text.trim() })
    setText('')
    setShowAdd(false)
    refresh()
  }
  const toggle = async (item: ChecklistItem) => {
    await api.checklist.update(item.id, { done: !item.done })
    refresh()
  }
  const remove = async (id: string) => {
    await api.checklist.delete(id)
    refresh()
  }

  return (
    <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong className="grow">{title}</strong>
        <button className="btn small ghost" onClick={() => setShowAdd((v) => !v)}>{showAdd ? '닫기' : '＋'}</button>
      </div>
      {items.length === 0 ? (
        <div className="muted" style={{ margin: '6px 0' }}>아직 항목이 없어요.</div>
      ) : (
        <div style={{ margin: '6px 0' }}>
          {items.map((item) => (
            <label key={item.id} className="checklist-row">
              <input type="checkbox" checked={item.done} onChange={() => toggle(item)} />
              <span className={item.done ? 'checklist-done' : ''}>{item.text}</span>
              <button className="btn small ghost" onClick={() => remove(item.id)}>×</button>
            </label>
          ))}
        </div>
      )}
      {showAdd && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="text" value={text} placeholder={addPlaceholder} autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="btn small primary" onClick={add}>추가</button>
        </div>
      )}
    </div>
  )
}
