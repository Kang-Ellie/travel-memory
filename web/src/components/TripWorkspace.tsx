import { useEffect, useRef, useState } from 'react'
import type {
  Trip, TimelineEvent, Place, Member, Expense, CurrencyRate, TransitSegment, Voucher, BucketItem, DayNote,
} from '../../shared/types'
import { api, fileUrl } from '../api'
import { fmtMoney, computeDailySpend } from '../settlement'
import { CATEGORY_COLOR, EXPENSE_CATEGORIES } from '../categories'
import BudgetBar from './BudgetBar'
import ArchiveBoard, { ARCHIVE_DRAG_TYPE } from './ArchiveBoard'
import MapTab from './MapTab'
import Lightbox from './Lightbox'
import Modal from './Modal'
import Select from './Select'

const PLACE_CATEGORIES = ['맛집', '카페', '명소', '쇼핑', '숙소', '공항', '기타']
const TRANSIT_MODES = ['도보', '지하철', '버스', '기차', '택시', '비행기', '배', '기타']
const TRANSIT_ICON: Record<string, string> = {
  도보: '🚶', 지하철: '🚇', 버스: '🚌', 기차: '🚄', 택시: '🚕', 비행기: '✈️', 배: '⛴',
}

export function dayCount(trip: Trip): number {
  const s = new Date(trip.startDate + 'T00:00:00')
  const e = new Date(trip.endDate + 'T00:00:00')
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1)
}

export function dayLabel(trip: Trip, day: number): string {
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
      <Modal title="이동 구간 수정" onClose={() => setEditing(false)}>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', border: 'none', padding: 0, margin: 0 }}>
          <div className="field"><label>위치</label>
            <Select value={afterEventId} onChange={(e) => setAfterEventId(e.target.value)}>
              <option value="">맨 앞 (첫 일정 전)</option>
              {dayEvents.map((e) => <option key={e.id} value={e.id}>{e.place.name} 다음</option>)}
            </Select></div>
          <div className="field"><label>교통수단</label>
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              {TRANSIT_MODES.map((m) => <option key={m} value={m}>{TRANSIT_ICON[m] ?? '➡️'} {m}</option>)}
            </Select></div>
          <div className="field"><label>소요시간</label>
            <input type="text" value={durationText} onChange={(e) => setDurationText(e.target.value)} /></div>
          <div className="field grow"><label>비고</label>
            <input type="text" value={note} placeholder="예: 2번 출구로 나가서 우회전" onChange={(e) => setNote(e.target.value)} /></div>
          <div style={{ marginTop: 12 }}>
            <button className="btn small primary" onClick={save}>저장</button>
            <button className="btn small" onClick={() => setEditing(false)} style={{ marginLeft: 6 }}>취소</button>
          </div>
        </div>
      </Modal>
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
          <Select value="" onChange={(e) => linkVoucher(e.target.value)} placeholder="바우처 선택">
            {vouchers.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
          </Select>
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
  purchaseItems: string
  paidBy: string
  splitWith: Set<string>
  isShared: boolean
}

function EventCard({
  ev, participants, eventExpenses, bucketItems, vouchers, dragIndex, onDragStart, onDrop, onChanged,
}: {
  ev: TimelineEvent
  participants: Member[]
  eventExpenses: Expense[]
  bucketItems: BucketItem[]
  vouchers: Voucher[]
  dragIndex: number
  onDragStart: (idx: number) => void
  onDrop: () => void
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [review, setReview] = useState(ev.review ?? '')
  const [linkUrl, setLinkUrl] = useState(ev.linkUrl ?? '')
  const [mustTry, setMustTry] = useState(ev.mustTry ?? '')
  const [memo, setMemo] = useState(ev.memo ?? '')
  const [bucketItemId, setBucketItemId] = useState(ev.bucketItemId ?? '')
  const [plannedTime, setPlannedTime] = useState(ev.plannedTime ?? '')
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const isAirport = ev.place.category === '공항'
  const [departAt, setDepartAt] = useState(ev.flight?.departAt ?? '')
  const [arriveAt, setArriveAt] = useState(ev.flight?.arriveAt ?? '')
  const [durationMinutes, setDurationMinutes] = useState(ev.flight?.durationMinutes != null ? String(ev.flight.durationMinutes) : '')
  const [bookingRef, setBookingRef] = useState(ev.flight?.bookingRef ?? '')
  const [bookedVia, setBookedVia] = useState(ev.flight?.bookedVia ?? '')
  const [departureLocation, setDepartureLocation] = useState(ev.flight?.departureLocation ?? '')
  const [confirmed, setConfirmed] = useState(ev.flight?.confirmed ?? false)
  const [voucherId, setVoucherId] = useState(ev.flight?.voucherId ?? '')
  const [qe, setQe] = useState<QuickExpenseState>({
    amount: '', currency: 'KRW', category: '식비', purchaseItems: '',
    paidBy: participants[0]?.id ?? '', splitWith: new Set(participants.map((m) => m.id)), isShared: true,
  })
  const photoInput = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setReview(ev.review ?? ''); setLinkUrl(ev.linkUrl ?? '')
    setMustTry(ev.mustTry ?? ''); setPlannedTime(ev.plannedTime ?? '')
    setMemo(ev.memo ?? '')
    setBucketItemId(ev.bucketItemId ?? '')
    setDepartAt(ev.flight?.departAt ?? ''); setArriveAt(ev.flight?.arriveAt ?? '')
    setDurationMinutes(ev.flight?.durationMinutes != null ? String(ev.flight.durationMinutes) : '')
    setBookingRef(ev.flight?.bookingRef ?? ''); setBookedVia(ev.flight?.bookedVia ?? '')
    setDepartureLocation(ev.flight?.departureLocation ?? ''); setConfirmed(ev.flight?.confirmed ?? false)
    setVoucherId(ev.flight?.voucherId ?? '')
    setEditing(true)
  }
  const setRating = async (n: number) => {
    await api.events.update(ev.id, {
      rating: ev.rating === n ? null : n, review: ev.review, linkUrl: ev.linkUrl,
      mustTry: ev.mustTry, memo: ev.memo, plannedTime: ev.plannedTime,
    })
    onChanged()
  }
  const save = async () => {
    await api.events.update(ev.id, {
      rating: ev.rating, review: review.trim() || null, linkUrl: linkUrl.trim() || null,
      mustTry: mustTry.trim() || null, memo: memo.trim() || null, plannedTime: plannedTime.trim() || null,
      bucketItemId: bucketItemId || null,
    })
    if (isAirport) {
      await api.events.setFlight(ev.id, {
        departAt: departAt.trim() || null, arriveAt: arriveAt.trim() || null,
        durationMinutes: durationMinutes.trim() ? Number(durationMinutes) : null,
        bookingRef: bookingRef.trim() || null, bookedVia: bookedVia.trim() || null,
        departureLocation: departureLocation.trim() || null, confirmed,
        voucherId: voucherId || null, voucherTitle: null,
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
      description: ev.place.name, paidBy: qe.paidBy,
      splitWith: qe.isShared ? [...qe.splitWith] : [qe.paidBy],
      spentAt: new Date().toISOString().slice(0, 10),
      paymentMethod: null, memo: null, purchaseItems: qe.purchaseItems.trim() || null,
      isShared: qe.isShared, isPrebooked: false,
    })
    setQe((s) => ({ ...s, amount: '', purchaseItems: '' }))
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
          {editing && (
            <Modal title={`${ev.place.name} 수정`} onClose={() => setEditing(false)}>
              {isAirport && (
                <div className="row" style={{ flexWrap: 'wrap', background: 'var(--blue-soft)' }}>
                  <div className="field"><label>🛫 출발장소</label>
                    <input type="text" value={departureLocation} placeholder="예: 인천공항 T2"
                      onChange={(e) => setDepartureLocation(e.target.value)} /></div>
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
                  <div className="field"><label>🎫 바우처 연결</label>
                    <Select value={voucherId} onChange={(e) => setVoucherId(e.target.value)}>
                      <option value="">— 선택 안함 —</option>
                      {vouchers.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                    </Select></div>
                  <label className="row" style={{ border: 'none', padding: 0, gap: 6, alignItems: 'center', width: 'auto' }}>
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                    ✅ 예약 확정
                  </label>
                </div>
              )}
              <div className="field" style={{ marginBottom: 6 }}>
                <label>방문 시간 (선택)</label>
                <input type="time" value={plannedTime} onChange={(e) => setPlannedTime(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 6 }}>
                <label>📝 메모 (발렛·주차·입장코드 등 실용 정보)</label>
                <textarea value={memo} placeholder="예: 발렛 맡김 — OO발렛 010-1234-5678, 3층 입구"
                  onChange={(e) => setMemo(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div className="field" style={{ marginBottom: 6 }}>
                <label>🌟 꼭 해봐야 하는 것 (한 줄에 하나씩)</label>
                <textarea value={mustTry} placeholder={'예:\n명란 정식\n창가 자리 뷰'}
                  onChange={(e) => setMustTry(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div className="field" style={{ marginBottom: 6 }}>
                <label>✨ 버킷리스트 연결 (선택)</label>
                <Select value={bucketItemId} onChange={(e) => setBucketItemId(e.target.value)}>
                  <option value="">— 선택 안함 —</option>
                  {bucketItems.map((b) => <option key={b.id} value={b.id}>{b.done ? '✓ ' : ''}{b.title}</option>)}
                </Select>
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
            </Modal>
          )}
          {!editing && (
            <>
              {isAirport && ev.flight && (ev.flight.departAt || ev.flight.arriveAt || ev.flight.bookingRef || ev.flight.bookedVia) && (
                <div className="muted" style={{ marginBottom: 8, fontWeight: 700 }}>
                  {ev.flight.departureLocation && `${ev.flight.departureLocation} · `}
                  🛫 {ev.flight.departAt ? new Date(ev.flight.departAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '?'}
                  {' → 🛬 '}
                  {ev.flight.arriveAt ? new Date(ev.flight.arriveAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '?'}
                  {ev.flight.durationMinutes != null && ` · ${formatDuration(ev.flight.durationMinutes)}`}
                  {ev.flight.bookingRef && ` · 예약번호 ${ev.flight.bookingRef}`}
                  {ev.flight.bookedVia && ` · ${ev.flight.bookedVia}`}
                  {ev.flight.confirmed && <span className="chip green" style={{ marginLeft: 6 }}>✅ 확정</span>}
                  {ev.flight.voucherId && (
                    <span className="chip green" style={{ marginLeft: 6 }} title={ev.flight.voucherTitle ?? ''}>
                      🎫 {ev.flight.voucherTitle}
                    </span>
                  )}
                </div>
              )}
              {ev.bucketItemTitle && <div className="chip purple" style={{ marginBottom: 8 }}>✨ {ev.bucketItemTitle}</div>}
              {ev.memo && (
                <div className="muted" style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>📝 {ev.memo}</div>
              )}
              {ev.mustTry && (
                <div style={{ marginBottom: 8 }}>
                  <div className="muted">🌟 꼭 해봐야 하는 것</div>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                    {ev.mustTry.split('\n').map((line) => line.trim()).filter(Boolean).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
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
          <span key={exp.id} className="event-expense-chip" title={exp.purchaseItems ?? undefined}>
            <span className="dot" style={{ background: CATEGORY_COLOR[exp.category as keyof typeof CATEGORY_COLOR] ?? '#999' }} />
            <span title={exp.isShared ? '공동지출' : '개인지출'}>{exp.isShared ? '👥' : '🙋'}</span>
            {exp.category} {fmtMoney(exp.amount, exp.currency)}
            {exp.purchaseItems && <span className="muted"> · {exp.purchaseItems}</span>}
            <button className="del" onClick={() => api.expenses.delete(exp.id).then(onChanged)}>×</button>
          </span>
        ))}
        <button className="btn small" onClick={() => setShowExpenseForm(true)}>＋ 비용 기록</button>
      </div>

      {showExpenseForm && (
        <Modal title="비용 기록" onClose={() => setShowExpenseForm(false)}>
          <div className="row" style={{ flexWrap: 'wrap', border: 'none', padding: 0, margin: 0 }}>
            <input type="number" placeholder="금액" value={qe.amount} style={{ width: 90 }}
              onChange={(e) => setQe((s) => ({ ...s, amount: e.target.value }))} />
            <Select value={qe.currency} onChange={(e) => setQe((s) => ({ ...s, currency: e.target.value }))}>
              {['KRW', 'JPY', 'USD', 'EUR', 'TWD', 'THB', 'VND'].map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select value={qe.category} onChange={(e) => setQe((s) => ({ ...s, category: e.target.value }))}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <input type="text" placeholder="뭘 먹었는지/샀는지" value={qe.purchaseItems} style={{ width: 140 }}
              onChange={(e) => setQe((s) => ({ ...s, purchaseItems: e.target.value }))} />
            {participants.length > 0 ? (
              <Select value={qe.paidBy} onChange={(e) => setQe((s) => ({ ...s, paidBy: e.target.value }))}>
                {participants.map((m) => <option key={m.id} value={m.id}>{m.name} 냄</option>)}
              </Select>
            ) : (
              <span className="muted">[🧮 정산] 탭에서 참여자를 먼저 추가하세요.</span>
            )}
            <label style={{ fontWeight: 700, display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={qe.isShared} onChange={(e) => setQe((s) => ({ ...s, isShared: e.target.checked }))} />
              공동지출
            </label>
            <div style={{ marginTop: 12 }}>
              <button className="btn small primary" onClick={addExpense}>기록</button>
              <button className="btn small ghost" onClick={() => setShowExpenseForm(false)} style={{ marginLeft: 6 }}>취소</button>
            </div>
          </div>
        </Modal>
      )}
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
  const [bucketItems, setBucketItems] = useState<BucketItem[]>([])
  const [dayNotes, setDayNotes] = useState<DayNote[]>([])
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
  const [showAddPlace, setShowAddPlace] = useState(false)
  const [showAddTransit, setShowAddTransit] = useState(false)
  const dragFrom = useRef<number | null>(null)

  const refresh = () => {
    api.events.list(trip.id).then(setEvents)
    api.places.list().then(setPlaces)
    api.tripMembers.list(trip.id).then(setMembers)
    api.expenses.list(trip.id).then(setExpenses)
    api.rates.list(trip.id).then(setRates)
    api.transit.list(trip.id).then(setTransit)
    api.vouchers.list(trip.id).then(setVouchers)
    api.bucket.list().then(setBucketItems)
    api.dayNotes.list(trip.id).then(setDayNotes)
  }
  useEffect(refresh, [trip.id])

  const dayEvents = events.filter((e) => e.dayNumber === day).sort((a, b) => a.sequence - b.sequence)
  const dayTransit = transit.filter((t) => t.dayNumber === day)
  const transitAfter = (eventId: string | null) => dayTransit.filter((t) => t.afterEventId === eventId)
  const expensesByEvent = new Map<string, Expense[]>()
  for (const exp of expenses) {
    if (!exp.eventId) continue
    const list = expensesByEvent.get(exp.eventId) ?? []
    list.push(exp)
    expensesByEvent.set(exp.eventId, list)
  }

  const dayCityLabel = (d: number): string | null => {
    const explicit = dayNotes.find((n) => n.dayNumber === d)?.cityName
    if (explicit) return explicit
    const evs = events.filter((e) => e.dayNumber === d).sort((a, b) => a.sequence - b.sequence)
    const cities = evs.map((e) => e.place.cityName).filter((c): c is string => !!c)
    if (cities.length === 0) return null
    const first = cities[0]
    const last = cities[cities.length - 1]
    return first === last ? first : `${first} - ${last}`
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
    setShowAddPlace(false)
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
    setShowAddTransit(false)
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

  const addPlaceForm = (
    <>
      <div className="field grow">
        <label>장소 선택</label>
        <Select value={selPlace} onChange={(e) => setSelPlace(e.target.value)}>
          <option value="">— 장소 선택 —</option>
          <option value="__new">✚ 새 장소 바로 등록</option>
          {places.map((p) => <option key={p.id} value={p.id}>[{p.category}] {p.name}</option>)}
        </Select>
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
            <Select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
              {PLACE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="field grow">
            <label>구글 지도 링크 (선택)</label>
            <input type="text" value={newMapUrl} onChange={(e) => setNewMapUrl(e.target.value)} placeholder="https://maps.app.goo.gl/..." />
          </div>
        </>
      )}
      <div style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={addEvent}>{day}일차에 추가</button>
      </div>
    </>
  )

  const addTransitForm = (
    <>
      <div className="field">
        <label>위치</label>
        <Select value={transitAfterId} onChange={(e) => setTransitAfterId(e.target.value)}>
          <option value="">맨 앞 (첫 일정 전)</option>
          {dayEvents.map((e) => <option key={e.id} value={e.id}>{e.place.name} 다음</option>)}
        </Select>
      </div>
      <div className="field">
        <label>교통수단</label>
        <Select value={transitMode} onChange={(e) => setTransitMode(e.target.value)}>
          {TRANSIT_MODES.map((m) => <option key={m} value={m}>{TRANSIT_ICON[m] ?? '➡️'} {m}</option>)}
        </Select>
      </div>
      <div className="field">
        <label>소요시간</label>
        <input type="text" value={transitDuration} placeholder="예: 4분" onChange={(e) => setTransitDuration(e.target.value)} />
      </div>
      <div className="field grow">
        <label>비고 (선택)</label>
        <input type="text" value={transitNote} placeholder="예: 2번 출구로 나가서 우회전" onChange={(e) => setTransitNote(e.target.value)} />
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={addTransit}>＋ 이동 추가</button>
      </div>
    </>
  )

  return (
    <div className="workspace">
      {/* 좌측: 일차 내비게이션 */}
      <div className="day-nav-col">
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
          const cityLabel = dayCityLabel(d)
          const spend = computeDailySpend(trip, expenses, d, rates).total
          return (
            <button key={d} className={`day-nav-btn ${day === d ? 'active' : ''}`} onClick={() => setDay(d)}>
              <div>{d}일차 <span style={{ fontWeight: 400, fontSize: 11 }}>{dayLabel(trip, d)}</span></div>
              {cityLabel && <div style={{ fontWeight: 400, fontSize: 11 }}>🌆 {cityLabel}</div>}
              <div style={{ fontWeight: 400, fontSize: 11 }}>💸 {fmtMoney(spend, 'KRW')}</div>
            </button>
          )
        })}
      </div>

      {/* 중앙: 타임라인 + 가계부 요약 */}
      <div>
        <BudgetBar trip={trip} expenses={expenses} rates={rates} />

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
                  bucketItems={bucketItems}
                  vouchers={vouchers}
                  dragIndex={idx}
                  onDragStart={(i) => { dragFrom.current = i }}
                  onDrop={() => reorder(idx)}
                  onChanged={refresh}
                />
                {transitAfter(ev.id).map((t) => <TransitChip key={t.id} segment={t} vouchers={vouchers} dayEvents={dayEvents} onChanged={refresh} />)}
              </div>
            ))}
          </div>

          <div className="row" style={{ flexWrap: 'wrap', marginTop: 14 }}>
            <button className="btn primary small" onClick={() => setShowAddPlace(true)}>＋ 장소 추가</button>
            <button className="btn small" onClick={() => setShowAddTransit(true)}>🚏 이동 구간 추가</button>
          </div>

          {showAddPlace && (
            <Modal title="장소 추가" onClose={() => setShowAddPlace(false)}>
              <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', border: 'none', padding: 0, margin: 0 }}>
                {addPlaceForm}
              </div>
            </Modal>
          )}
          {showAddTransit && (
            <Modal title="이동 구간 추가" onClose={() => setShowAddTransit(false)}>
              <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', border: 'none', padding: 0, margin: 0 }}>
                {addTransitForm}
              </div>
            </Modal>
          )}
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
