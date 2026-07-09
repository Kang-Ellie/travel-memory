import { useEffect, useRef, useState } from 'react'
import type { Trip, TimelineEvent, Place, Member, Expense } from '../../shared/types'
import { api, fileUrl } from '../api'
import { fmtMoney } from '../settlement'
import { CATEGORY_COLOR, EXPENSE_CATEGORIES } from '../categories'
import BudgetBar from './BudgetBar'
import ArchiveBoard, { ARCHIVE_DRAG_TYPE } from './ArchiveBoard'
import MapTab from './MapTab'
import DayNoteBox from './DayNoteBox'
import Lightbox from './Lightbox'

const PLACE_CATEGORIES = ['맛집', '카페', '명소', '쇼핑', '숙소', '공항', '기타']

function dayCount(trip: Trip): number {
  const s = new Date(trip.startDate + 'T00:00:00')
  const e = new Date(trip.endDate + 'T00:00:00')
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1)
}

function dayLabel(trip: Trip, day: number): string {
  const d = new Date(trip.startDate + 'T00:00:00')
  d.setDate(d.getDate() + day - 1)
  const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  return `${d.getMonth() + 1}/${d.getDate()} (${week})`
}

interface QuickExpenseState {
  amount: string
  currency: string
  category: string
  paidBy: string
  splitWith: Set<string>
}

function EventCard({
  ev, participants, eventExpenses, dragIndex, onDragStart, onDrop, onChanged,
}: {
  ev: TimelineEvent
  participants: Member[]
  eventExpenses: Expense[]
  dragIndex: number
  onDragStart: (idx: number) => void
  onDrop: () => void
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [review, setReview] = useState(ev.review ?? '')
  const [linkUrl, setLinkUrl] = useState(ev.linkUrl ?? '')
  const [mustTry, setMustTry] = useState(ev.mustTry ?? '')
  const [plannedTime, setPlannedTime] = useState(ev.plannedTime ?? '')
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [qe, setQe] = useState<QuickExpenseState>({
    amount: '', currency: 'KRW', category: '식비',
    paidBy: participants[0]?.id ?? '', splitWith: new Set(participants.map((m) => m.id)),
  })
  const photoInput = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setReview(ev.review ?? ''); setLinkUrl(ev.linkUrl ?? '')
    setMustTry(ev.mustTry ?? ''); setPlannedTime(ev.plannedTime ?? '')
    setEditing(true)
  }
  const setRating = async (n: number) => {
    await api.events.update(ev.id, {
      rating: ev.rating === n ? null : n, review: ev.review, linkUrl: ev.linkUrl,
      mustTry: ev.mustTry, plannedTime: ev.plannedTime,
    })
    onChanged()
  }
  const save = async () => {
    await api.events.update(ev.id, {
      rating: ev.rating, review: review.trim() || null, linkUrl: linkUrl.trim() || null,
      mustTry: mustTry.trim() || null, plannedTime: plannedTime.trim() || null,
    })
    setEditing(false)
    onChanged()
  }
  const onPhotosPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    await api.photos.add(ev.id, files)
    onChanged()
  }

  const addExpense = async () => {
    const amt = parseFloat(qe.amount)
    if (!amt || amt <= 0 || !qe.paidBy) return
    await api.expenses.create({
      tripId: ev.tripId, eventId: ev.id, amount: amt, currency: qe.currency, category: qe.category,
      description: ev.place.name, paidBy: qe.paidBy, splitWith: [...qe.splitWith], spentAt: new Date().toISOString().slice(0, 10),
    })
    setQe((s) => ({ ...s, amount: '' }))
    setShowExpenseForm(false)
    onChanged()
  }

  const mainPhoto = ev.photos[0]
  const restPhotos = ev.photos.slice(1)

  return (
    <div
      className="event-card"
      draggable
      onDragStart={() => onDragStart(dragIndex)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDrop() }}
    >
      <div className="event-head">
        <span className="seq-badge">{ev.sequence}</span>
        <span className="event-place">{ev.place.name}</span>
        <span className="chip blue">{ev.place.category}</span>
        {ev.plannedTime && !editing && <span className="chip yellow">🕒 {ev.plannedTime}</span>}
        <span className="stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={`star ${ev.rating != null && n <= ev.rating ? 'on' : ''}`}
              onClick={() => setRating(n)} title={`${n}점`}>★</button>
          ))}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {!editing && <button className="btn small" onClick={startEdit}>수정</button>}
          <button className="btn small" onClick={() => {
            if (confirm(`'${ev.place.name}' 일정을 삭제할까요?`)) api.events.delete(ev.id).then(onChanged)
          }}>삭제</button>
        </span>
      </div>
      {ev.place.address && <div className="muted" style={{ marginTop: 4 }}>📍 {ev.place.address}</div>}

      <div className="event-card-body">
        <div className="event-photo-col">
          <input ref={photoInput} type="file" multiple accept="image/*" hidden onChange={onPhotosPicked} />
          {mainPhoto ? (
            <img className="main-photo" src={fileUrl(mainPhoto.filePath)} alt="" onClick={() => setLightbox(fileUrl(mainPhoto.filePath))} />
          ) : (
            <div className="main-photo photo-placeholder" onClick={() => photoInput.current?.click()}>📷 사진 추가</div>
          )}
          <div className="thumb-row">
            {restPhotos.map((p) => (
              <div key={p.id} className="photo-thumb">
                <img src={fileUrl(p.filePath)} alt="" onClick={() => setLightbox(fileUrl(p.filePath))} />
                <button className="photo-del" title="사진 삭제" onClick={() => api.photos.delete(p.id).then(onChanged)}>×</button>
              </div>
            ))}
          </div>
          {mainPhoto && (
            <button className="btn small" style={{ marginTop: 6, width: '100%' }} onClick={() => photoInput.current?.click()}>
              ＋ 사진 추가
            </button>
          )}
          {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
        </div>

        <div className="event-content-col">
          {editing ? (
            <>
              <div className="field" style={{ marginBottom: 6 }}>
                <label>방문 시간 (선택)</label>
                <input type="time" value={plannedTime} onChange={(e) => setPlannedTime(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 6 }}>
                <label>🌟 꼭 해봐야 하는 것</label>
                <input type="text" value={mustTry} placeholder="예: 명란 정식, 창가 자리 뷰"
                  onChange={(e) => setMustTry(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div className="field" style={{ marginBottom: 6 }}>
                <label>리뷰 · 사진 일기</label>
                <textarea value={review} placeholder="우리끼리만 보는 솔직 리뷰 ✍️"
                  onChange={(e) => setReview(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div className="field" style={{ marginBottom: 8 }}>
                <label>참고 링크</label>
                <input type="text" value={linkUrl} placeholder="블로그·인스타 URL"
                  onChange={(e) => setLinkUrl(e.target.value)} style={{ width: '100%' }} />
              </div>
              <button className="btn small primary" onClick={save}>저장</button>
              <button className="btn small" onClick={() => setEditing(false)} style={{ marginLeft: 6 }}>취소</button>
            </>
          ) : (
            <>
              {ev.mustTry && <div className="chip pink" style={{ marginBottom: 8 }}>🌟 꼭 해봐야 하는 것: {ev.mustTry}</div>}
              {ev.review ? (
                <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{ev.review}</p>
              ) : (
                <p className="muted" style={{ margin: '0 0 8px' }}>아직 리뷰가 없어요. [수정]을 눌러 적어보세요.</p>
              )}
              {ev.linkUrl && (
                <div className="muted">🔗 <a href={ev.linkUrl} target="_blank" rel="noreferrer">{ev.linkUrl}</a></div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="quick-expense-row">
        {eventExpenses.map((exp) => (
          <span key={exp.id} className="event-expense-chip">
            <span className="dot" style={{ background: CATEGORY_COLOR[exp.category as keyof typeof CATEGORY_COLOR] ?? '#999' }} />
            {exp.category} {fmtMoney(exp.amount, exp.currency)}
            <button className="del" onClick={() => api.expenses.delete(exp.id).then(onChanged)}>×</button>
          </span>
        ))}
        {!showExpenseForm ? (
          <button className="btn small" onClick={() => setShowExpenseForm(true)}>＋ 비용 기록</button>
        ) : (
          <>
            <input type="number" placeholder="금액" value={qe.amount} style={{ width: 90 }}
              onChange={(e) => setQe((s) => ({ ...s, amount: e.target.value }))} />
            <select value={qe.currency} onChange={(e) => setQe((s) => ({ ...s, currency: e.target.value }))}>
              {['KRW', 'JPY', 'USD', 'EUR', 'TWD', 'THB', 'VND'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={qe.category} onChange={(e) => setQe((s) => ({ ...s, category: e.target.value }))}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {participants.length > 0 ? (
              <select value={qe.paidBy} onChange={(e) => setQe((s) => ({ ...s, paidBy: e.target.value }))}>
                {participants.map((m) => <option key={m.id} value={m.id}>{m.name} 냄</option>)}
              </select>
            ) : (
              <span className="muted">[🧮 정산] 탭에서 참여자를 먼저 추가하세요.</span>
            )}
            <button className="btn small primary" onClick={addExpense}>기록</button>
            <button className="btn small ghost" onClick={() => setShowExpenseForm(false)}>취소</button>
          </>
        )}
      </div>
    </div>
  )
}

export default function TripWorkspace({ trip }: { trip: Trip }) {
  const days = dayCount(trip)
  const [day, setDay] = useState(1)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [rightPanel, setRightPanel] = useState<'map' | 'archive'>('archive')
  const [selPlace, setSelPlace] = useState('')
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newCategory, setNewCategory] = useState('맛집')
  const [dragOver, setDragOver] = useState(false)
  const dragFrom = useRef<number | null>(null)

  const refresh = () => {
    api.events.list(trip.id).then(setEvents)
    api.places.list().then(setPlaces)
    api.tripMembers.list(trip.id).then(setMembers)
    api.expenses.list(trip.id).then(setExpenses)
  }
  useEffect(refresh, [trip.id])

  const dayEvents = events.filter((e) => e.dayNumber === day).sort((a, b) => a.sequence - b.sequence)
  const expensesByEvent = new Map<string, Expense[]>()
  for (const exp of expenses) {
    if (!exp.eventId) continue
    const list = expensesByEvent.get(exp.eventId) ?? []
    list.push(exp)
    expensesByEvent.set(exp.eventId, list)
  }

  const addEvent = async () => {
    let placeId = selPlace
    if (placeId === '__new') {
      if (!newName.trim()) return
      const p = await api.places.create({ name: newName, address: newAddress, category: newCategory })
      placeId = p.id
      setNewName(''); setNewAddress('')
    }
    if (!placeId) return
    await api.events.create({ tripId: trip.id, placeId, dayNumber: day })
    setSelPlace('')
    refresh()
  }

  const reorder = async (targetIdx: number) => {
    const from = dragFrom.current
    dragFrom.current = null
    if (from == null || from === targetIdx) return
    const ids = dayEvents.map((e) => e.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(targetIdx, 0, moved)
    setEvents((prev) => {
      const others = prev.filter((e) => e.dayNumber !== day)
      const reordered = ids.map((eid, i) => {
        const found = prev.find((e) => e.id === eid)!
        return { ...found, sequence: i + 1 }
      })
      return [...others, ...reordered]
    })
    await api.events.reorder({ tripId: trip.id, dayNumber: day, orderedIds: ids })
  }

  const handleZoneDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const archiveId = e.dataTransfer.getData(ARCHIVE_DRAG_TYPE)
    if (archiveId) {
      await api.archive.convertToEvent({ archiveId, tripId: trip.id, dayNumber: day })
      refresh()
    }
  }

  return (
    <div className="workspace">
      {/* 좌측: 일차 내비게이션 */}
      <div className="day-nav-col">
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
          <button key={d} className={`day-nav-btn ${day === d ? 'active' : ''}`} onClick={() => setDay(d)}>
            {d}일차<br /><span style={{ fontWeight: 400, fontSize: 11 }}>{dayLabel(trip, d)}</span>
          </button>
        ))}
      </div>

      {/* 중앙: 타임라인 + 가계부 요약 */}
      <div>
        <BudgetBar trip={trip} expenses={expenses} />
        <div className="row route-summary">
          <span style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>🧭 {day}일차 · {dayLabel(trip, day)}</span>
          <span className="grow muted">
            {dayEvents.length === 0 ? '아직 동선이 없어요' : dayEvents.map((e) => e.place.name).join('  →  ')}
          </span>
        </div>
        <DayNoteBox tripId={trip.id} dayNumber={day} />

        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
          style={{ marginTop: 12 }}
          onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes(ARCHIVE_DRAG_TYPE)) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleZoneDrop}
        >
          {dayEvents.length === 0 && (
            <div className="empty">
              이 날의 동선이 비어 있어요. 아래에서 장소를 추가하거나, 오른쪽 보관함 카드를 이 위로 끌어다 놓아보세요.
            </div>
          )}
          {dayEvents.map((ev, idx) => (
            <EventCard
              key={ev.id}
              ev={ev}
              participants={members}
              eventExpenses={expensesByEvent.get(ev.id) ?? []}
              dragIndex={idx}
              onDragStart={(i) => { dragFrom.current = i }}
              onDrop={() => reorder(idx)}
              onChanged={refresh}
            />
          ))}
        </div>

        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 14 }}>
          <div className="field grow">
            <label>장소 추가</label>
            <select value={selPlace} onChange={(e) => setSelPlace(e.target.value)}>
              <option value="">— 장소 선택 —</option>
              <option value="__new">✚ 새 장소 바로 등록</option>
              {places.map((p) => <option key={p.id} value={p.id}>[{p.category}] {p.name}</option>)}
            </select>
          </div>
          {selPlace === '__new' && (
            <>
              <div className="field">
                <label>이름</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="장소명" />
              </div>
              <div className="field grow">
                <label>주소 (선택)</label>
                <input type="text" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="주소" />
              </div>
              <div className="field">
                <label>분류</label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                  {PLACE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </>
          )}
          <button className="btn primary" onClick={addEvent}>{day}일차에 추가</button>
        </div>
      </div>

      {/* 우측: 지도 / 보관함 전환 */}
      <div>
        <div className="right-toggle">
          <button className={`pill ${rightPanel === 'archive' ? 'active' : ''}`} onClick={() => setRightPanel('archive')}>📎 보관함</button>
          <button className={`pill ${rightPanel === 'map' ? 'active' : ''}`} onClick={() => setRightPanel('map')}>🗺 지도</button>
        </div>
        {rightPanel === 'archive' ? <ArchiveBoard tripId={trip.id} /> : <MapTab trip={trip} />}
      </div>
    </div>
  )
}
