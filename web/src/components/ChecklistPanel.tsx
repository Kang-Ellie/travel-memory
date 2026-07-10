import { useEffect, useState } from 'react'
import type { ChecklistScope, ChecklistItem } from '../../shared/types'
import { PACKING_PRESETS } from '../../shared/types'
import { api } from '../api'
import Modal from './Modal'
import Select from './Select'

const PACKING_CATEGORIES = Object.keys(PACKING_PRESETS)
const SEEDABLE_SCOPES = new Set<ChecklistScope>(['predeparture', 'packing'])

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
  const [category, setCategory] = useState(PACKING_CATEGORIES[0] ?? '')
  const [showAdd, setShowAdd] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const usesCategory = scope === 'packing'

  const refresh = () => { api.checklist.list(tripId, scope, dayNumber).then(setItems) }
  useEffect(refresh, [tripId, scope, dayNumber])

  const add = async () => {
    if (!text.trim()) return
    await api.checklist.create({
      tripId, scope, dayNumber: dayNumber ?? null, text: text.trim(),
      category: usesCategory ? category : null,
    })
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
  const loadPresets = async () => {
    if (scope !== 'predeparture' && scope !== 'packing') return
    setSeeding(true)
    await api.checklist.seedPresets(tripId, scope)
    setSeeding(false)
    refresh()
  }

  const renderRow = (item: ChecklistItem) => (
    <label key={item.id} className="checklist-row">
      <input type="checkbox" checked={item.done} onChange={() => toggle(item)} />
      <span className={item.done ? 'checklist-done' : ''}>{item.text}</span>
      <button className="btn small ghost" onClick={() => remove(item.id)}>×</button>
    </label>
  )

  return (
    <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong className="grow">{title}</strong>
        {SEEDABLE_SCOPES.has(scope) && (
          <button className="btn small ghost" onClick={loadPresets} disabled={seeding}>
            {seeding ? '불러오는 중…' : '✨ 프리셋 불러오기'}
          </button>
        )}
        <button className="btn small ghost" onClick={() => setShowAdd(true)}>＋</button>
      </div>
      {items.length === 0 ? (
        <div className="muted" style={{ margin: '6px 0' }}>아직 항목이 없어요.</div>
      ) : usesCategory ? (
        <div style={{
          margin: '6px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0 16px',
        }}>
          {[...PACKING_CATEGORIES, ...[...new Set(items.map((i) => i.category))].filter((c): c is string => !!c && !PACKING_CATEGORIES.includes(c))]
            .map((cat) => {
              const inCat = items.filter((i) => i.category === cat)
              if (inCat.length === 0) return null
              return (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{cat}</div>
                  {inCat.map(renderRow)}
                </div>
              )
            })}
          {items.filter((i) => !i.category).length > 0 && items.filter((i) => !i.category).map(renderRow)}
        </div>
      ) : (
        <div style={{ margin: '6px 0' }}>
          {items.map(renderRow)}
        </div>
      )}
      {showAdd && (
        <Modal title={`${title} — 항목 추가`} onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {usesCategory && (
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {PACKING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            )}
            <input type="text" value={text} placeholder={addPlaceholder} autoFocus
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button className="btn small primary" onClick={add}>추가</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
