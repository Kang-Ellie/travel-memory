import { useEffect, useRef, useState } from 'react'
import type { Trip, TimelineEvent, Place, Member, Expense, CurrencyRate, TransitSegment, Voucher } from '../../shared/types'
import { api, fileUrl } from '../api'
import { fmtMoney, computeDailySpend } from '../settlement'
import { CATEGORY_COLOR, EXPENSE_CATEGORIES } from '../categories'
import BudgetBar from './BudgetBar'
import ArchiveBoard, { ARCHIVE_DRAG_TYPE } from './ArchiveBoard'
import MapTab from './MapTab'
import DayNoteBox from './DayNoteBox'
import Lightbox from './Lightbox'
import ChecklistPanel from './ChecklistPanel'

const PLACE_CATEGORIES = ['맛집', '카페', '명소', '쇼핑', '숙소', '공항', '기타']
const TRANSIT_MODES = ['도보', '지하철', '버스', '기차', '택시', '비행기', '배', '기타']
const TRANSIT_ICON: Record<string, string> = {
  도보: '🚶', 지하철: '🚇', 버스: '🚌', 기차: '🚄', 택시: '🚕', 비행기: '✈️', 배: '⛴',
}

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

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}시간${m > 0 ? ` ${m}분` : ''}` : `${m}분`
}

function TransitChip({
  segment, vouchers, dayEvents, onChanged,
}: { segment: TransitSegment; vouchers: Voucher[]; dayEvents: TimelineEvent[]; onChanged: () => void }) {
  const [linking, setLinking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [mode, setMode] = useState(segment.mode)
  const [durationText, setDurationText] = useState(segment.durationText ?? '')
  const [note, setNote] = useState(segment.note ?? '')
  const [afterEventId, setAfterEventId] = useState(segment.afterEventId ?? '')

  const save = async () => {
    await api.transit.update(segment.id, {
      mode, durationText: durationText.trim() || null, note: note.trim() || null, afterEventId: afterEventId || null,
    })
    setEditing(false)
    onChanged()
  }
  const linkVoucher = async (voucherId: string) => {
    await api.transit.update(segment.id, { voucherId: voucherId || null })
    setLinking(false)
    onChanged()
  }
  const unlink = async () => {
    await api.transit.update(segment.id, { voucherId: null })
    onChanged()
  }
  const remove = async () => {
    if (confirm(`'${segment.mode}' 이동 구간을 삭제할까요?`)) await api.transit.delete(segment.id)
    onChanged()
  }

  if (editing) {
    return (
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--yellow-soft)', marginLeft: 22 }}>
        <div className="field"><label>위치</label>
          <select value={afterEventId} onChange={(e) => setAfterEventId(e.target.value)}>
            <option value="">맨 앞 (첫 일정 전)</option>
            {dayEvents.map((e) => <option key={e.id} value={e.id}>{e.place.name} 다음</option>)}
          </select></div>
        <div className="field"><label>교통수단</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            {TRANSIT_MODES.map((m) => <option key={m} value={m}>{TRANSIT_ICON[m] ?? '➡️'} {m}</option>)}
          </select></div>
        <div className="field"><label>소요시간</label>
          <input type="text" value={durationText} onChange={(e) => setDurationText(e.target.value)} /></div>
        <div className="field grow"><label>비고</label>
          <input type="text" value={note} placeholder="예: 2번 출구로 나가서 우회전" onChange={(e) => setNote(e.target.value)} /></div>
        <button className="btn small primary" onClick={save}>저장</button>
        <button className="btn small" onClick={() => setEditing(false)}>취소</button>
      </div>
    )
  }

  return (
    <div className="transit-chip">
      <span>{TRANSIT_ICON[segment.mode] ?? '➡️'} {segment.mode}{segment.durationText ? ` · ${segment.durationText}` : ''}</span>
      {segment.note && <span className="muted">· {segment.note}</span>}
      {segment.voucherId ? (
        <span className="chip green" title={segment.voucherTitle ?? ''} style={{ cursor: 'pointer' }} onClick={unlink}>
          🎫 예약완료 ({segment.voucherTitle})
        </span>
      ) : linking ? (
        vouchers.length === 0 ? (
          <span className="muted">[📎 바우처] 탭에 먼저 파일을 올려두세요.</span>
        ) : (
          <select defaultValue="" onChange={(e) => linkVoucher(e.target.value)}>
            <option value="" disabled>바우처 선택</option>
            {vouchers.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
        )
      ) : (
        <button className="btn small ghost" onClick={() => setLinking(true)}>🎫 예약 미확인 · 연결</button>
      )}
      <button className="btn small ghost" onClick={() => setEditing(true)}>수정</button>
      <button className="btn small ghost" onClick={remove}>×</button>
    </div>
  )
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const isAirport = ev.place.category === '공항'
  const [departAt, setDepartAt] = useState(ev.flight?.departAt ?? '')
  const [arriveAt, setArriveAt] = useState(ev.flight?.arriveAt ?? '')
  const [durationMinutes, setDurationMinutes] = useState(ev.flight?.durationMinutes != null ? String(ev.flight.durationMinutes) : '')
  const [bookingRef, setBookingRef] = useState(ev.flight?.bookingRef ?? '')
  const [bookedVia, setBookedVia] = useState(ev.flight?.bookedVia ?? '')
  const [qe, setQe] = useState<QuickExpenseState>({
    amount: '', currency: 'KRW', category: '식비',
    paidBy: participants[0]?.id ?? '', splitWith: new Set(participants.map((m) => m.id)),
  })
  const photoInput = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setReview(ev.review ?? ''); setLinkUrl(ev.linkUrl ?? '')
    setMustTry(ev.mustTry ?? ''); setPlannedTime(ev.plannedTime ?? '')
    setDepartAt(ev.flight?.departAt ?? ''); setArriveAt(ev.flight?.arriveAt ?? '')
    setDurationMinutes(ev.flight?.durationMinutes != null ? String(ev.flight.durationMinutes) : '')
    setBookingRef(ev.flight?.bookingRef ?? ''); setBookedVia(ev.flight?.bookedVia ?? '')
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
    if (isAirport) {
      await api.events.setFlight(ev.id, {
        departAt: departAt.trim() || null, arriveAt: arriveAt.trim() || null,
        durationMinutes: durationMinutes.trim() ? Number(durationMinutes) : null,
        bookingRef: bookingRef.trim() || null, bookedVia: bookedVia.trim() || null,
      })
    }
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
      paymentMethod: null, memo: null, purchaseItems: null, isShared: true, isPrebooked: false,
    })
    setQe((s) => ({ ...s, amount: '' }))
    setShowExpenseForm(false)
    onChanged()
  }

  const mainPhoto = ev.photos[0]
  const restPhotos = ev.photos.slice(1)
  const photoUrls = ev.photos.map((p) => fileUrl(p.filePath))

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
      {(ev.place.address || ev.place.mapUrl) && (
        <div className="muted" style={{ marginTop: 4 }}>
          {ev.place.address && <>📍 {ev.place.address} </>}
          {ev.place.mapUrl && <a href={ev.place.mapUrl} target="_blank" rel="noreferrer">🗺 지도에서 보기</a>}
        </div>
      )}

      <div className="event-card-body">
        <div className="event-photo-col">
          <input ref={photoInput} type="file" multiple accept="image/*" hidden onChange={onPhotosPicked} />
          {mainPhoto ? (
            <div className="photo-thumb">
              <img className="main-photo" src={fileUrl(mainPhoto.filePath)} alt="" onClick={() => setLightboxIndex(0)} />
              {ev.photos.length > 1 && (
                <button className="photo-del" title="사진 삭제" onClick={() => api.photos.delete(mainPhoto.id).then(onChanged)}>×</button>
              )}
            </div>
          ) : (
            <div className="main-photo photo-placeholder" onClick={() => photoInput.current?.click()}>📷 사진 추가</div>
          )}
          <div className="thumb-row">
            {restPhotos.map((p, i) => (
              <div key={p.id} className="photo-thumb">
                <img src={fileUrl(p.filePath)} alt="" onClick={() => setLightboxIndex(i + 1)} />
                <button className="photo-del" title="사진 삭제" onClick={() => api.photos.delete(p.id).then(onChanged)}>×</button>
              </div>
            ))}
          </div>
          {mainPhoto && (
            <button className="btn small" style={{ marginTop: 6, width: '100%' }} onClick={() => photoInput.current?.click()}>
              ＋ 사진 추가
            </button>
          )}
          {lightboxIndex != null && (
            <Lightbox images={photoUrls} index={lightboxIndex} onClose={() => setLightboxIndex(null)} />
          )}
        </div>

        <div className="event-content-col">
          {editing ? (
            <>
              {isAirport && (
                <div className="row" style={{ flexWrap: 'wrap', background: 'var(--blue-soft)', marginBottom: 8 }}>
                  <div className="field"><label>✈️ 출발시간</label>
                    <input type="datetime-local" value={departAt} onChange={(e) => setDepartAt(e.target.value)} /></div>
                  <div className="field"><label>🛬 도착시간</label>
                    <input type="datetime-local" value={arriveAt} onChange={(e) => setArriveAt(e.target.value)} /></div>
                  <div className="field" style={{ maxWidth: 100 }}><label>소요(분)</label>
                    <input type="number" value={durationMinutes} placeholder="75" onChange={(e) => setDurationMinutes(e.target.value)} /></div>
                  <div className="field"><label>예약번호</label>
                    <input type="text" value={bookingRef} placeholder="ABC123" onChange={(e) => setBookingRef(e.target.value)} /></div>
                  <div className="field grow"><label>예약처</label>
                    <input type="text" value={bookedVia} placeholder="예: 진에어 앱" onChange={(e) => setBookedVia(e.target.value)} /></div>
                </div>
              )}
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
              {isAirport && ev.flight && (ev.flight.departAt || ev.flight.arriveAt || ev.flight.bookingRef || ev.flight.bookedVia) && (
                <div className="muted" style={{ marginBottom: 8, fontWeight: 700 }}>
                  🛫 {ev.flight.departAt ? new Date(ev.flight.departAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '?'}
                  {' → 🛬 '}
                  {ev.flight.arriveAt ? new Date(ev.flight.arriveAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '?'}
                  {ev.flight.durationMinutes != null && ` · ${formatDuration(ev.flight.durationMinutes)}`}
                  {ev.flight.bookingRef && ` · 예약번호 ${ev.flight.bookingRef}`}
                  {ev.flight.bookedVia && ` · ${ev.flight.bookedVia}`}
                </div>
              )}
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
  const [rates, setRates] = useState<CurrencyRate[]>([])
  const [transit, setTransit] = useState<TransitSegment[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [rightPanel, setRightPanel] = useState<'map' | 'archive'>('archive')
  const [selPlace, setSelPlace] = useState('')
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newCategory, setNewCategory] = useState('맛집')
  const [newMapUrl, setNewMapUrl] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [transitAfterId, setTransitAfterId] = useState('')
  const [transitMode, setTransitMode] = useState('지하철')
  const [transitDuration, setTransitDuration] = useState('')
  const [transitNote, setTransitNote] = useState('')
  const dragFrom = useRef<number | null>(null)

  const refresh = () => {
    api.events.list(trip.id).then(setEvents)
    api.places.list().then(setPlaces)
    api.tripMembers.list(trip.id).then(setMembers)
    api.expenses.list(trip.id).then(setExpenses)
    api.rates.list(trip.id).then(setRates)
    api.transit.list(trip.id).then(setTransit)
    api.vouchers.list(trip.id).then(setVouchers)
  }
  useEffect(refresh, [trip.id])

  const dayEvents = events.filter((e) => e.dayNumber === day).sort((a, b) => a.sequence - b.sequence)
  const dayTransit = transit.filter((t) => t.dayNumber === day)
  const transitAfter = (eventId: string | null) => dayTransit.filter((t) => t.afterEventId === eventId)
  const dailySpend = computeDailySpend(trip, expenses, day, rates)
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
      const p = await api.places.create({
        name: newName, address: newAddress, category: newCategory, mapUrl: newMapUrl.trim() || null,
      })
      placeId = p.id
      setNewName(''); setNewAddress(''); setNewMapUrl('')
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

  const addTransit = async () => {
    await api.transit.create({
      tripId: trip.id, dayNumber: day, afterEventId: transitAfterId || null,
      mode: transitMode, durationText: transitDuration.trim() || null, note: transitNote.trim() || null,
    })
    setTransitDuration(''); setTransitNote('')
    refresh()
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
        <BudgetBar trip={trip} expenses={expenses} rates={rates} />
        <div className="row route-summary">
          <span style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>🧭 {day}일차 · {dayLabel(trip, day)}</span>
          <span className="grow muted">
            {dayEvents.length === 0 ? '아직 동선이 없어요' : dayEvents.map((e) => e.place.name).join('  →  ')}
          </span>
          <span style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>💸 {fmtMoney(dailySpend.total, 'KRW')}</span>
        </div>
        <ChecklistPanel tripId={trip.id} scope="day" dayNumber={day} title="✅ 오늘 해야할 일" addPlaceholder="예: 호텔 체크인, 유심 개통" />
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
          {transitAfter(null).map((t) => <TransitChip key={t.id} segment={t} vouchers={vouchers} dayEvents={dayEvents} onChanged={refresh} />)}
          {dayEvents.map((ev, idx) => (
            <div key={ev.id}>
              <EventCard
                ev={ev}
                participants={members}
                eventExpenses={expensesByEvent.get(ev.id) ?? []}
                dragIndex={idx}
                onDragStart={(i) => { dragFrom.current = i }}
                onDrop={() => reorder(idx)}
                onChanged={refresh}
              />
              {transitAfter(ev.id).map((t) => <TransitChip key={t.id} segment={t} vouchers={vouchers} dayEvents={dayEvents} onChanged={refresh} />)}
            </div>
          ))}
        </div>

        {dayEvents.length > 0 && (
          <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field">
              <label>🚏 이동 구간 추가 — 위치</label>
              <select value={transitAfterId} onChange={(e) => setTransitAfterId(e.target.value)}>
                <option value="">맨 앞 (첫 일정 전)</option>
                {dayEvents.map((e) => <option key={e.id} value={e.id}>{e.place.name} 다음</option>)}
              </select>
            </div>
            <div className="field">
              <label>교통수단</label>
              <select value={transitMode} onChange={(e) => setTransitMode(e.target.value)}>
                {TRANSIT_MODES.map((m) => <option key={m} value={m}>{TRANSIT_ICON[m] ?? '➡️'} {m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>소요시간</label>
              <input type="text" value={transitDuration} placeholder="예: 4분" onChange={(e) => setTransitDuration(e.target.value)} />
            </div>
            <div className="field grow">
              <label>비고 (선택)</label>
              <input type="text" value={transitNote} placeholder="예: 2번 출구로 나가서 우회전" onChange={(e) => setTransitNote(e.target.value)} />
            </div>
            <button className="btn small" onClick={addTransit}>＋ 이동 추가</button>
          </div>
        )}

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
              <div className="field grow">
                <label>구글 지도 링크 (선택)</label>
                <input type="text" value={newMapUrl} onChange={(e) => setNewMapUrl(e.target.value)} placeholder="https://maps.app.goo.gl/..." />
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
