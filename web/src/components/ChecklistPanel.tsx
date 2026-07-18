import { useEffect, useState } from 'react'
import type { ChecklistScope, ChecklistItem } from '../../shared/types'
import { PACKING_PRESETS } from '../../shared/types'
import { api } from '../api'
import Modal from './Modal'
import Select from './Select'
import DropdownMenu from './DropdownMenu'

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
  // 토글마다 서버 왕복을 기다린 뒤 화면을 갱신하면 해외 로밍처럼 느린 네트워크에서 체감이 크게
  // 느려서, 누르는 즉시 화면부터 바꾸고(낙관적 업데이트) 서버 요청은 뒤에서 보낸다.
  // 실패하면 원래 상태로 되돌린다 — 에러 토스트는 api.ts가 전역으로 이미 띄워준다.
  const toggle = async (item: ChecklistItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))
    try {
      await api.checklist.update(item.id, { done: !item.done })
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)))
    }
  }
  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    try {
      await api.checklist.delete(id)
    } catch {
      refresh()
    }
  }
  const loadPresets = async () => {
    if (scope !== 'predeparture' && scope !== 'packing') return
    setSeeding(true)
    await api.checklist.seedPresets(tripId, scope)
    setSeeding(false)
    refresh()
  }

  const renderRow = (item: ChecklistItem) => (
    <div
      key={item.id}
      className={`check-item ${item.done ? 'done' : ''}`}
      onClick={() => toggle(item)}
    >
      <span className="check-stamp"><span className="mark">OK</span></span>
      <span className="check-item-text">{item.text}</span>
      <button className="x-btn" onClick={(e) => { e.stopPropagation(); remove(item.id) }}>×</button>
    </div>
  )

  const renderGroup = (cat: string, inCat: ChecklistItem[]) => {
    const catDone = inCat.filter((i) => i.done).length
    return (
      <div key={cat} className="checklist-group">
        <div className="checklist-group-head">
          <span className={`luggage-tag ${catDone === inCat.length ? 'done' : ''}`}>
            {cat}<span className="tag-count">{catDone}/{inCat.length}</span>
          </span>
        </div>
        {inCat.map(renderRow)}
      </div>
    )
  }

  const doneCount = items.filter((i) => i.done).length
  const allDone = items.length > 0 && doneCount === items.length
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0
  const extraCats = [...new Set(items.map((i) => i.category))]
    .filter((c): c is string => !!c && !PACKING_CATEGORIES.includes(c))
  const uncategorized = items.filter((i) => !i.category)

  return (
    <div className="checklist-doc">
      <div className="checklist-doc-head">
        <div className="checklist-doc-title"><span>{title}</span></div>
        <div className="checklist-gate">
          {items.length > 0 && (
            <>
              <div className="checklist-gate-track">
                <div className="checklist-gate-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className={`checklist-gate-count ${allDone ? 'done' : ''}`}>{doneCount}/{items.length}</span>
            </>
          )}
          {seeding && <span className="muted">불러오는 중…</span>}
          <button className="btn small ghost" onClick={() => setShowAdd(true)}>＋</button>
          {SEEDABLE_SCOPES.has(scope) && (
            <DropdownMenu actions={[{ label: '✨ 프리셋 불러오기', onClick: loadPresets }]} />
          )}
        </div>
      </div>

      <div className="checklist-doc-body">
        {items.length === 0 ? (
          <div className="checklist-empty">
            {SEEDABLE_SCOPES.has(scope)
              ? '아직 항목이 없어요. ＋로 추가하거나 프리셋을 불러오세요.'
              : '아직 항목이 없어요. ＋로 추가해보세요.'}
          </div>
        ) : usesCategory ? (
          <div className="checklist-cols">
            {[...PACKING_CATEGORIES, ...extraCats].map((cat) => {
              const inCat = items.filter((i) => i.category === cat)
              return inCat.length ? renderGroup(cat, inCat) : null
            })}
            {uncategorized.length > 0 && renderGroup('기타', uncategorized)}
          </div>
        ) : (
          <div>{items.map(renderRow)}</div>
        )}
      </div>

      {showAdd && (
        <Modal title={`${title} — 항목 추가`} onClose={() => setShowAdd(false)}>
          <div className="form-row" style={{ alignItems: 'flex-end', marginBottom: 16 }}>
            {usesCategory && (
              <div className="field"><label>분류</label>
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {PACKING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select></div>
            )}
            <div className="field grow"><label>내용</label>
              <input type="text" value={text} placeholder={addPlaceholder} autoFocus style={{ width: '100%' }}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()} /></div>
          </div>
          <button className="btn primary" onClick={add}>＋ 추가</button>
        </Modal>
      )}
    </div>
  )
}
