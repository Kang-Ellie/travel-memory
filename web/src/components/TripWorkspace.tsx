import { useEffect, useRef, useState } from 'react'
import type {
  Trip, TimelineEvent, Place, Member, Expense, CurrencyRate, TransitSegment, Voucher, BucketItem, DayNote, TripCity,
} from '../../shared/types'
import { PAYMENT_METHOD_PRESETS } from '../../shared/types'
import { api, fileUrl } from '../api'
import { fmtMoney, computeDailySpend, dailyBudgetStatus } from '../settlement'
import { CATEGORY_COLOR, EXPENSE_CATEGORIES, flagEmoji } from '../categories'
import ArchiveBoard, { ARCHIVE_DRAG_TYPE } from './ArchiveBoard'
import MapTab from './MapTab'
import PlanBPanel from './PlanBPanel'
import Lightbox from './Lightbox'
import Modal from './Modal'
import Select from './Select'
import ChecklistPanel from './ChecklistPanel'
import DayNoteEditModal from './DayNoteEditModal'
import DayDiaryModal from './DayDiaryModal'
import DropdownMenu from './DropdownMenu'
import PlaceMeta from './PlaceMeta'
import BoardingPassCard from './BoardingPassCard'
import ValetPassCard from './ValetPassCard'
import LodgingPassCard from './LodgingPassCard'
import ReservationPassCard from './ReservationPassCard'
import DateTimePicker from './DateTimePicker'
import TimePicker from './TimePicker'
import PlaceDetailPanel from './PlaceDetailPanel'
import TripBoardView from './TripBoardView'
import TodayStrip from './TodayStrip'

const PLACE_CATEGORIES = ['맛집', '카페', '명소', '쇼핑', '숙소', '공항', '기타']
const TRANSIT_MODES = ['도보', '지하철', '버스', '기차', '택시', '비행기', '배', '기타']
const TRANSIT_ICON: Record<string, string> = {
  도보: '🚶', 지하철: '🚇', 버스: '🚌', 기차: '🚄', 택시: '🚕', 비행기: '✈️', 배: '⛴',
}
// 도로/대중교통 경로가 있는 수단만 구글 Distance Matrix로 자동 계산 가능 (서버 TRANSIT_MODE_TO_GOOGLE와 동일 기준).
const AUTO_CALC_MODES = new Set(['도보', '지하철', '버스', '기차', '택시'])

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

// N일차의 실제 날짜(YYYY-MM-DD) — 일차별 지출 합계가 spentAt 날짜 기준이라 지출 저장 시 이 값을 쓴다.
export function dayISODate(trip: Trip, day: number): string {
  const d = new Date(trip.startDate + 'T00:00:00')
  d.setDate(d.getDate() + day - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 여행 기간 중이면 오늘 날짜에 해당하는 일차 번호를, 아니면 null을 반환한다.
export function todayDayNumber(trip: Trip): number | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const s = new Date(trip.startDate + 'T00:00:00')
  const e = new Date(trip.endDate + 'T00:00:00')
  if (today < s || today > e) return null
  return Math.round((today.getTime() - s.getTime()) / 86_400_000) + 1
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
  const [calculating, setCalculating] = useState(false)

  const originIdx = dayEvents.findIndex((e) => e.id === afterEventId)
  const destEvent = originIdx >= 0 ? dayEvents[originIdx + 1] : null
  const canAutoCalc = AUTO_CALC_MODES.has(mode) && originIdx >= 0 && !!destEvent

  const autoCalc = async () => {
    if (originIdx < 0 || !destEvent) return
    setCalculating(true)
    const res = await api.directions.duration(dayEvents[originIdx].place.id, destEvent.place.id, mode)
    setCalculating(false)
    if ('error' in res) { alert(res.error); return }
    setDurationText(res.durationText)
  }

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
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={durationText} onChange={(e) => setDurationText(e.target.value)} />
              {canAutoCalc && (
                <button type="button" className="btn small" onClick={autoCalc} disabled={calculating}>
                  {calculating ? '계산 중…' : '🧭 자동'}
                </button>
              )}
            </div>
          </div>
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
      {segment.voucherId && (
        <a
          className="chip green"
          title={segment.voucherTitle ?? '바우처 열기'}
          href={fileUrl(vouchers.find((v) => v.id === segment.voucherId)?.filePath ?? '')}
          target="_blank"
          rel="noreferrer"
        >
          🎫 {segment.voucherTitle ?? '바우처'}
        </a>
      )}
      <DropdownMenu actions={[
        segment.voucherId
          ? { label: '🔗 바우처 연결 해제', onClick: unlink }
          : { label: '🎫 예약 · 바우처 연결', onClick: () => setLinking(true) },
        { label: '✏️ 수정', onClick: () => setEditing(true) },
        { label: '🗑 삭제', danger: true, onClick: remove },
      ]} />
      {linking && (
        <Modal title="바우처 연결" onClose={() => setLinking(false)}>
          {vouchers.length === 0 ? (
            <div className="empty">[📎 바우처] 탭에 먼저 파일을 올려두세요.</div>
          ) : (
            <div className="field">
              <label>바우처 선택</label>
              <Select value="" onChange={(e) => linkVoucher(e.target.value)} placeholder="바우처 선택">
                {vouchers.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
              </Select>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

interface QuickExpenseState {
  amount: string
  currency: string
  category: string
  purchaseItems: string
  paymentMethod: string
  paidBy: string
  splitWith: Set<string>
  isShared: boolean
}


function EventCard({
  ev, participants, eventExpenses, bucketItems, vouchers, dragIndex, onDragStart, onDrop, onChanged, isToday, displaySeq, spentAtDate,
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
  isToday?: boolean
  // 하루 안에서 티켓(항공·발렛·숙소)을 뺀 방문 순번. 티켓이면 null → 배지 자체를 안 그린다.
  displaySeq: number | null
  // 이 일정이 속한 일차의 실제 날짜(YYYY-MM-DD) — 빠른 지출의 spentAt으로 쓴다.
  // (기록한 "오늘" 날짜로 저장하면 여행 일차별 합계에 안 잡히는 버그가 있었음)
  spentAtDate: string
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
  const [placeDetailOpen, setPlaceDetailOpen] = useState(false)
  const isAirport = ev.place.category === '공항'
  const isValet = ev.place.category === '발렛'
  const isLodging = ev.place.category === '숙소'
  // 발렛/항공/숙소는 "리뷰할 장소"가 아니라 예매해둔 티켓이라, 별점·리뷰 안내 같은
  // 장소 방문용 UI 대신 탑승권/발렛권/숙박권 모양의 카드만 보여준다.
  const isTicket = isAirport || isValet || isLodging
  const [departAt, setDepartAt] = useState(ev.flight?.departAt ?? '')
  const [arriveAt, setArriveAt] = useState(ev.flight?.arriveAt ?? '')
  const [durationMinutes, setDurationMinutes] = useState(ev.flight?.durationMinutes != null ? String(ev.flight.durationMinutes) : '')
  const [bookingRef, setBookingRef] = useState(ev.flight?.bookingRef ?? '')
  const [bookedVia, setBookedVia] = useState(ev.flight?.bookedVia ?? '')
  const [departureLocation, setDepartureLocation] = useState(ev.flight?.departureLocation ?? '')
  const [confirmed, setConfirmed] = useState(ev.flight?.confirmed ?? false)
  const [voucherId, setVoucherId] = useState(ev.flight?.voucherId ?? '')
  const [airline, setAirline] = useState(ev.flight?.airline ?? '')
  const [flightNo, setFlightNo] = useState(ev.flight?.flightNo ?? '')
  const [destination, setDestination] = useState(ev.flight?.destination ?? '')
  const [gate, setGate] = useState(ev.flight?.gate ?? '')
  const [seat, setSeat] = useState(ev.flight?.seat ?? '')
  const [passengerIds, setPassengerIds] = useState<Set<string>>(
    new Set(ev.flight?.passengerIds?.length ? ev.flight.passengerIds : participants.map((m) => m.id)),
  )
  const [scheduledAt, setScheduledAt] = useState(ev.valet?.scheduledAt ?? '')
  const [valetLocation, setValetLocation] = useState(ev.valet?.location ?? '')
  const [valetCompany, setValetCompany] = useState(ev.valet?.company ?? '')
  const [checkInAt, setCheckInAt] = useState(ev.lodging?.checkInAt ?? '')
  const [checkOutAt, setCheckOutAt] = useState(ev.lodging?.checkOutAt ?? '')
  const [breakfastIncluded, setBreakfastIncluded] = useState(ev.lodging?.breakfastIncluded ?? false)
  const [roomType, setRoomType] = useState(ev.lodging?.roomType ?? '')
  const [reservedAt, setReservedAt] = useState(ev.reservation?.reservedAt ?? '')
  const [partySize, setPartySize] = useState(ev.reservation?.partySize != null ? String(ev.reservation.partySize) : '')
  const logoInput = useRef<HTMLInputElement>(null)
  const [qe, setQe] = useState<QuickExpenseState>({
    amount: '', currency: 'KRW', category: '맛집', purchaseItems: '', paymentMethod: '',
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
    setAirline(ev.flight?.airline ?? ''); setFlightNo(ev.flight?.flightNo ?? '')
    setDestination(ev.flight?.destination ?? ''); setGate(ev.flight?.gate ?? '')
    setSeat(ev.flight?.seat ?? '')
    setPassengerIds(new Set(ev.flight?.passengerIds?.length ? ev.flight.passengerIds : participants.map((m) => m.id)))
    setScheduledAt(ev.valet?.scheduledAt ?? ''); setValetLocation(ev.valet?.location ?? '')
    setValetCompany(ev.valet?.company ?? '')
    setCheckInAt(ev.lodging?.checkInAt ?? ''); setCheckOutAt(ev.lodging?.checkOutAt ?? '')
    setBreakfastIncluded(ev.lodging?.breakfastIncluded ?? false); setRoomType(ev.lodging?.roomType ?? '')
    if (isValet) { setBookingRef(ev.valet?.bookingRef ?? ''); setBookedVia(ev.valet?.bookedVia ?? ''); setConfirmed(ev.valet?.confirmed ?? false); setVoucherId(ev.valet?.voucherId ?? '') }
    if (isLodging) { setBookingRef(ev.lodging?.bookingRef ?? ''); setBookedVia(ev.lodging?.bookedVia ?? ''); setConfirmed(ev.lodging?.confirmed ?? false); setVoucherId(ev.lodging?.voucherId ?? '') }
    if (!isTicket) {
      setReservedAt(ev.reservation?.reservedAt ?? ''); setPartySize(ev.reservation?.partySize != null ? String(ev.reservation.partySize) : '')
      setBookingRef(ev.reservation?.bookingRef ?? ''); setBookedVia(ev.reservation?.bookedVia ?? '')
      setConfirmed(ev.reservation?.confirmed ?? false); setVoucherId(ev.reservation?.voucherId ?? '')
    }
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
        airline: airline.trim() || null, airlineLogoPath: ev.flight?.airlineLogoPath ?? null,
        flightNo: flightNo.trim() || null, destination: destination.trim() || null,
        gate: gate.trim() || null, seat: seat.trim() || null,
        passengerIds: [...passengerIds],
      })
    }
    if (isValet) {
      await api.events.setValet(ev.id, {
        scheduledAt: scheduledAt.trim() || null, location: valetLocation.trim() || null,
        company: valetCompany.trim() || null, bookedVia: bookedVia.trim() || null,
        bookingRef: bookingRef.trim() || null, confirmed, voucherId: voucherId || null,
        voucherTitle: null, note: null,
      })
    }
    if (isLodging) {
      await api.events.setLodging(ev.id, {
        checkInAt: checkInAt.trim() || null, checkOutAt: checkOutAt.trim() || null,
        bookingRef: bookingRef.trim() || null, bookedVia: bookedVia.trim() || null,
        confirmed, voucherId: voucherId || null, voucherTitle: null, note: null,
        breakfastIncluded, roomType: roomType.trim() || null,
      })
    }
    if (!isTicket) {
      const hasReservation = reservedAt.trim() || partySize.trim() || bookingRef.trim() || bookedVia.trim() || confirmed || voucherId
      if (hasReservation) {
        await api.events.setReservation(ev.id, {
          reservedAt: reservedAt.trim() || null,
          partySize: partySize.trim() ? Number(partySize) : null,
          bookingRef: bookingRef.trim() || null, bookedVia: bookedVia.trim() || null,
          confirmed, voucherId: voucherId || null, voucherTitle: null, note: null,
        })
      } else if (ev.reservation) {
        await api.events.deleteReservation(ev.id)
      }
    }
    setEditing(false)
    onChanged()
  }
  const onLogoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await api.events.uploadFlightLogo(ev.id, file)
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
      spentAt: spentAtDate,
      paymentMethod: qe.paymentMethod.trim() || null, memo: null, purchaseItems: qe.purchaseItems.trim() || null,
      isShared: qe.isShared, isPrebooked: false,
    })
    setQe((s) => ({ ...s, amount: '', purchaseItems: '', paymentMethod: '' }))
    setShowExpenseForm(false)
    onChanged()
  }

  const mainPhoto = ev.photos[0]
  const restPhotos = ev.photos.slice(1)
  const photoUrls = ev.photos.map((p) => fileUrl(p.filePath))

  return (
    <div
      className={isTicket ? 'event-card ticket-bare' : 'card event-card'}
      draggable
      onDragStart={() => onDragStart(dragIndex)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDrop() }}
    >
      <div className={`event-head ${isTicket ? 'ticket-only' : ''}`}>
        {!isTicket && displaySeq != null && <span className="seq-badge">{displaySeq}</span>}
        {!isTicket && (
          <span className="event-place" style={{ cursor: 'pointer' }} onClick={() => setPlaceDetailOpen(true)} title="장소 족보에서 상세 정보 보기">
            {ev.place.name}
          </span>
        )}
        {!isTicket && <span className="chip blue">{ev.place.category}</span>}
        {!isTicket && ev.plannedTime && !editing && <span className="chip yellow">🕒 {ev.plannedTime}</span>}
        {!isTicket && (
          <span className="stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={`star ${ev.rating != null && n <= ev.rating ? 'on' : ''}`}
                onClick={() => setRating(n)} title={`${n}점`}>★</button>
            ))}
          </span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          <DropdownMenu
            actions={[
              { label: '📷 사진 추가', onClick: () => photoInput.current?.click() },
              { label: '💰 비용 기록', onClick: () => setShowExpenseForm(true) },
              'divider',
              { label: '✏️ 수정', onClick: startEdit },
              {
                label: '🗑 삭제', danger: true, onClick: () => {
                  if (confirm(`'${ev.place.name}' 일정을 삭제할까요?`)) api.events.delete(ev.id).then(onChanged)
                },
              },
            ]}
          />
        </span>
      </div>
      {!isTicket && (ev.place.address || ev.place.mapUrl) && (
        <div className="muted" style={{ marginTop: 6 }}>
          {ev.place.mapUrl ? (
            <a className="plain-link" href={ev.place.mapUrl} target="_blank" rel="noreferrer" title="지도에서 보기">
              📍 {ev.place.address || '지도에서 보기'}
            </a>
          ) : (
            <span>📍 {ev.place.address}</span>
          )}
        </div>
      )}
      {!isTicket && <div style={{ marginTop: 6 }}><PlaceMeta place={ev.place} /></div>}

      <input ref={photoInput} type="file" multiple accept="image/*" hidden onChange={onPhotosPicked} />
      <div className="event-card-body">
        {ev.photos.length > 0 && (
          <div className="event-photo-col">
            <div className="photo-thumb">
              <img className="main-photo" src={fileUrl(mainPhoto!.filePath)} alt="" loading="lazy" decoding="async" onClick={() => setLightboxIndex(0)} />
              {ev.photos.length > 1 && (
                <button className="photo-del" title="사진 삭제" onClick={() => api.photos.delete(mainPhoto!.id).then(onChanged)}>×</button>
              )}
            </div>
            {restPhotos.length > 0 && (
              <div className="thumb-row">
                {restPhotos.map((p, i) => (
                  <div key={p.id} className="photo-thumb">
                    <img src={fileUrl(p.filePath)} alt="" loading="lazy" decoding="async" onClick={() => setLightboxIndex(i + 1)} />
                    <button className="photo-del" title="사진 삭제" onClick={() => api.photos.delete(p.id).then(onChanged)}>×</button>
                  </div>
                ))}
              </div>
            )}
            {lightboxIndex != null && (
              <Lightbox images={photoUrls} index={lightboxIndex} onClose={() => setLightboxIndex(null)} />
            )}
          </div>
        )}

        <div className="event-content-col">
          {editing && (
            <Modal title={`${ev.place.name} 수정`} onClose={() => setEditing(false)}>
              <p className="muted" style={{ marginTop: 0 }}>
                여기서는 이 일정(방문 시간·리뷰·메모 등)만 수정해요. 장소 이름·주소·분류·평점처럼 장소 자체의 정보는
                여러 여행에서 공유되기 때문에 [📍 장소 족보] 탭에서 수정해야 다른 여행에도 함께 반영돼요.
              </p>
              {isAirport && (
                <div className="row" style={{ flexWrap: 'wrap', background: 'var(--blue-soft)' }}>
                  <input ref={logoInput} type="file" accept="image/*" hidden onChange={onLogoPicked} />
                  <div className="field"><label>항공사 로고 (선택)</label>
                    <button type="button" className="btn small" onClick={() => logoInput.current?.click()}>
                      {ev.flight?.airlineLogoPath ? '🖼 로고 변경' : '🖼 로고 업로드'}
                    </button></div>
                  <div className="field"><label>항공사</label>
                    <input type="text" value={airline} placeholder="예: 진에어" onChange={(e) => setAirline(e.target.value)} /></div>
                  <div className="field"><label>편명</label>
                    <input type="text" value={flightNo} placeholder="예: LJ203" onChange={(e) => setFlightNo(e.target.value)} /></div>
                  <div className="field grow"><label>도착지</label>
                    <input type="text" value={destination} placeholder="예: 나리타 (NRT)" onChange={(e) => setDestination(e.target.value)} /></div>
                  <div className="field"><label>🛫 출발장소</label>
                    <input type="text" value={departureLocation} placeholder="예: 인천공항 T2"
                      onChange={(e) => setDepartureLocation(e.target.value)} /></div>
                  <div className="field"><label>✈️ 출발시간</label>
                    <DateTimePicker value={departAt} onChange={(e) => setDepartAt(e.target.value)} /></div>
                  <div className="field"><label>🛬 도착시간</label>
                    <DateTimePicker value={arriveAt} onChange={(e) => setArriveAt(e.target.value)} /></div>
                  <div className="field" style={{ maxWidth: 100 }}><label>소요(분)</label>
                    <input type="number" value={durationMinutes} placeholder="75" onChange={(e) => setDurationMinutes(e.target.value)} /></div>
                  <div className="field" style={{ maxWidth: 100 }}><label>게이트</label>
                    <input type="text" value={gate} placeholder="83E" onChange={(e) => setGate(e.target.value)} /></div>
                  <div className="field" style={{ maxWidth: 100 }}><label>좌석</label>
                    <input type="text" value={seat} placeholder="04B" onChange={(e) => setSeat(e.target.value)} /></div>
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
                  {participants.length > 0 && (
                    <div className="field grow">
                      <label>🧑‍🤝‍🧑 탑승자 (가족이 따로 티켓을 샀으면 체크 해제)</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {participants.map((m) => (
                          <label key={m.id} style={{ fontWeight: 700, display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input type="checkbox" checked={passengerIds.has(m.id)}
                              onChange={(e) => {
                                const next = new Set(passengerIds)
                                e.target.checked ? next.add(m.id) : next.delete(m.id)
                                setPassengerIds(next)
                              }} />
                            {m.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {isValet && (
                <div className="row" style={{ flexWrap: 'wrap', background: 'var(--blue-soft)' }}>
                  <div className="field"><label>🕐 예정 시간</label>
                    <DateTimePicker value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></div>
                  <div className="field grow"><label>위치</label>
                    <input type="text" value={valetLocation} placeholder="예: 단기주차장 지하1층 A구역"
                      onChange={(e) => setValetLocation(e.target.value)} /></div>
                  <div className="field grow"><label>🚗 발렛사</label>
                    <input type="text" value={valetCompany} placeholder="예: 투루발렛" onChange={(e) => setValetCompany(e.target.value)} /></div>
                  <div className="field"><label>예약번호</label>
                    <input type="text" value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} /></div>
                  <div className="field grow"><label>예약처</label>
                    <input type="text" value={bookedVia} onChange={(e) => setBookedVia(e.target.value)} /></div>
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
              {isLodging && (
                <div className="row" style={{ flexWrap: 'wrap', background: 'var(--blue-soft)' }}>
                  <div className="field"><label>체크인</label>
                    <DateTimePicker value={checkInAt} onChange={(e) => setCheckInAt(e.target.value)} /></div>
                  <div className="field"><label>체크아웃</label>
                    <DateTimePicker value={checkOutAt} onChange={(e) => setCheckOutAt(e.target.value)} /></div>
                  <div className="field grow"><label>🛏 룸 타입</label>
                    <input type="text" value={roomType} placeholder="예: 디럭스 더블룸" onChange={(e) => setRoomType(e.target.value)} /></div>
                  <div className="field"><label>예약번호</label>
                    <input type="text" value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} /></div>
                  <div className="field grow"><label>예약처</label>
                    <input type="text" value={bookedVia} placeholder="예: 부킹닷컴" onChange={(e) => setBookedVia(e.target.value)} /></div>
                  <div className="field"><label>🎫 바우처 연결</label>
                    <Select value={voucherId} onChange={(e) => setVoucherId(e.target.value)}>
                      <option value="">— 선택 안함 —</option>
                      {vouchers.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                    </Select></div>
                  <label className="row" style={{ border: 'none', padding: 0, gap: 6, alignItems: 'center', width: 'auto' }}>
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                    ✅ 예약 확정
                  </label>
                  <label className="row" style={{ border: 'none', padding: 0, gap: 6, alignItems: 'center', width: 'auto' }}>
                    <input type="checkbox" checked={breakfastIncluded} onChange={(e) => setBreakfastIncluded(e.target.checked)} />
                    🍳 조식 포함
                  </label>
                </div>
              )}
              {/* 티켓(항공·발렛·숙소)은 "방문지"가 아니라 예약 서류라서, 방문 시간·꼭 해봐야 하는 것·
                  버킷리스트·리뷰·참고 링크 같은 방문 기록용 필드는 아예 숨긴다. 메모(실용 정보)만 유지. */}
              {!isTicket && (
                <div className="row" style={{ flexWrap: 'wrap', background: 'var(--blue-soft)' }}>
                  <div className="field" style={{ width: '100%', marginBottom: 2 }}>
                    <strong>🎫 예약 정보 (예약했다면 입력 — 카드에 점선 예약 티켓으로 나와요)</strong>
                  </div>
                  <div className="field"><label>예약 일시</label>
                    <DateTimePicker value={reservedAt} onChange={(e) => setReservedAt(e.target.value)} /></div>
                  <div className="field" style={{ maxWidth: 90 }}><label>인원</label>
                    <input type="number" value={partySize} placeholder="2" onChange={(e) => setPartySize(e.target.value)} /></div>
                  <div className="field"><label>예약번호</label>
                    <input type="text" value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} /></div>
                  <div className="field grow"><label>예약처</label>
                    <input type="text" value={bookedVia} placeholder="예: 캐치테이블, 전화" onChange={(e) => setBookedVia(e.target.value)} /></div>
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
              {!isTicket && (
                <div className="field" style={{ marginBottom: 6 }}>
                  <label>방문 시간 (선택)</label>
                  <TimePicker value={plannedTime} onChange={(e) => setPlannedTime(e.target.value)} />
                </div>
              )}
              <div className="field" style={{ marginBottom: 6 }}>
                <label>📝 메모 (발렛·주차·입장코드 등 실용 정보)</label>
                <textarea value={memo} placeholder="예: 발렛 맡김 — OO발렛 010-1234-5678, 3층 입구"
                  onChange={(e) => setMemo(e.target.value)} style={{ width: '100%' }} />
              </div>
              {!isTicket && (
                <>
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
                </>
              )}
              <button className="btn small primary" onClick={save}>저장</button>
              <button className="btn small" onClick={() => setEditing(false)} style={{ marginLeft: 6 }}>취소</button>
            </Modal>
          )}
          {!editing && (
            <>
              {!isTicket && ev.reservation && (
                <div style={{ marginBottom: 8 }}>
                  <ReservationPassCard reservation={ev.reservation} vouchers={vouchers} />
                </div>
              )}
              {isAirport && (
                <div style={{ marginBottom: 8 }}>
                  {ev.flight && (ev.flight.departAt || ev.flight.arriveAt || ev.flight.bookingRef || ev.flight.bookedVia) ? (
                    <BoardingPassCard flight={ev.flight} fromName={ev.place.name} participants={participants} vouchers={vouchers} />
                  ) : (
                    <button type="button" className="btn small" onClick={startEdit}>✈️ 탑승권 정보 입력하기</button>
                  )}
                </div>
              )}
              {isValet && (
                <div style={{ marginBottom: 8 }}>
                  {ev.valet && (ev.valet.scheduledAt || ev.valet.bookingRef || ev.valet.bookedVia) ? (
                    <ValetPassCard valet={ev.valet} placeName={ev.place.name} vouchers={vouchers} />
                  ) : (
                    <button type="button" className="btn small" onClick={startEdit}>🚗 발렛 티켓 정보 입력하기</button>
                  )}
                </div>
              )}
              {isLodging && (
                <div style={{ marginBottom: 8 }}>
                  {ev.lodging && (ev.lodging.checkInAt || ev.lodging.checkOutAt || ev.lodging.bookingRef) ? (
                    <LodgingPassCard lodging={ev.lodging} placeName={ev.place.name} vouchers={vouchers} />
                  ) : (
                    <button type="button" className="btn small" onClick={startEdit}>🏨 숙소 티켓 정보 입력하기</button>
                  )}
                </div>
              )}
              {ev.bucketItemTitle && <div className="chip purple" style={{ marginBottom: 8 }}>✨ {ev.bucketItemTitle}</div>}
              {ev.memo && (
                <div className="muted" style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>📝 {ev.memo}</div>
              )}
              {!isTicket && ev.mustTry && (
                <div style={{ marginBottom: 8 }}>
                  <div className="muted">🌟 꼭 해봐야 하는 것</div>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                    {ev.mustTry.split('\n').map((line) => line.trim()).filter(Boolean).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!isTicket && (ev.review ? (
                <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{ev.review}</p>
              ) : isToday ? (
                <button type="button" className="btn small ghost" style={{ marginBottom: 8 }} onClick={startEdit}>
                  ✍️ 오늘 리뷰 남기기
                </button>
              ) : (
                <p className="muted" style={{ margin: '0 0 8px' }}>아직 리뷰가 없어요. [수정]을 눌러 적어보세요.</p>
              ))}
              {!isTicket && ev.linkUrl && (
                <div className="muted">🔗 <a href={ev.linkUrl} target="_blank" rel="noreferrer">{ev.linkUrl}</a></div>
              )}
            </>
          )}
        </div>
      </div>

      {eventExpenses.filter((e) => !e.isPrebooked).length > 0 && (
        <div className="quick-expense-row">
          {eventExpenses.filter((e) => !e.isPrebooked).map((exp) => (
            <span key={exp.id} className="event-expense-chip" title={exp.purchaseItems ?? undefined}>
              <span
                className={`dot ${exp.isShared ? 'shared' : 'personal'}`}
                style={{ background: CATEGORY_COLOR[exp.category as keyof typeof CATEGORY_COLOR] ?? '#999' }}
                title={exp.isShared ? '공동지출' : '개인지출'}
              />
              {exp.category} {fmtMoney(exp.amount, exp.currency)}
              {exp.purchaseItems && <span className="muted"> · {exp.purchaseItems}</span>}
              <button className="del" onClick={() => api.expenses.delete(exp.id).then(onChanged)}>×</button>
            </span>
          ))}
        </div>
      )}

      {showExpenseForm && (
        <Modal title="비용 기록" onClose={() => setShowExpenseForm(false)}>
          <div className="form-row">
            <div className="field" style={{ maxWidth: 110 }}><label>금액</label>
              <input type="number" placeholder="금액" value={qe.amount}
                onChange={(e) => setQe((s) => ({ ...s, amount: e.target.value }))} /></div>
            <div className="field" style={{ maxWidth: 100 }}><label>통화</label>
              <Select value={qe.currency} onChange={(e) => setQe((s) => ({ ...s, currency: e.target.value }))}>
                {['KRW', 'JPY', 'USD', 'EUR', 'TWD', 'THB', 'VND'].map((c) => <option key={c} value={c}>{c}</option>)}
              </Select></div>
            <div className="field"><label>분류</label>
              <Select value={qe.category} onChange={(e) => setQe((s) => ({ ...s, category: e.target.value }))}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select></div>
            <div className="field"><label>결제수단 (선택)</label>
              <Select value={qe.paymentMethod} onChange={(e) => setQe((s) => ({ ...s, paymentMethod: e.target.value }))}>
                <option value="">— 선택 안함 —</option>
                {PAYMENT_METHOD_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select></div>
          </div>
          <div className="form-row">
            <div className="field grow"><label>뭘 먹었는지/샀는지 (선택)</label>
              <input type="text" placeholder="예: 명란정식, 기념품" value={qe.purchaseItems}
                onChange={(e) => setQe((s) => ({ ...s, purchaseItems: e.target.value }))} /></div>
            {participants.length > 0 ? (
              <div className="field"><label>누가 냈나요</label>
                <Select value={qe.paidBy} onChange={(e) => setQe((s) => ({ ...s, paidBy: e.target.value }))}>
                  {participants.map((m) => <option key={m.id} value={m.id}>{m.name} 냄</option>)}
                </Select></div>
            ) : (
              <span className="muted">[🧾 지출] 탭에서 참여자를 먼저 추가하세요.</span>
            )}
          </div>
          <label style={{ fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, marginBottom: 14 }}>
            <input type="checkbox" checked={qe.isShared} onChange={(e) => setQe((s) => ({ ...s, isShared: e.target.checked }))} />
            공동지출
          </label>
          <div>
            <button className="btn small primary" onClick={addExpense}>기록</button>
            <button className="btn small ghost" onClick={() => setShowExpenseForm(false)} style={{ marginLeft: 6 }}>취소</button>
          </div>
        </Modal>
      )}
      {placeDetailOpen && (
        <Modal title={`${ev.place.name} · 방문 기록`} onClose={() => setPlaceDetailOpen(false)}>
          <PlaceDetailPanel placeId={ev.place.id} />
        </Modal>
      )}
    </div>
  )
}

export default function TripWorkspace({ trip }: { trip: Trip }) {
  const days = dayCount(trip)
  const todayNum = todayDayNumber(trip)
  const [day, setDay] = useState(() => todayNum ?? 1)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [rates, setRates] = useState<CurrencyRate[]>([])
  const [transit, setTransit] = useState<TransitSegment[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [bucketItems, setBucketItems] = useState<BucketItem[]>([])
  const [dayNotes, setDayNotes] = useState<DayNote[]>([])
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [diaryDay, setDiaryDay] = useState<number | null>(null)
  const [rightPanel, setRightPanel] = useState<'map' | 'archive' | 'planb'>('archive')
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
  const [transitCalculating, setTransitCalculating] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [bulkUploading, setBulkUploading] = useState(false)
  const dragFrom = useRef<number | null>(null)
  const bulkPhotoInput = useRef<HTMLInputElement>(null)

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

  const dayEvents = events.filter((e) => e.dayNumber === day).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
  // 표시용 방문 순번 — 티켓(항공·발렛·숙소)은 방문지가 아니라 번호에서 빼고,
  // 나머지만 1부터 다시 센다 (그냥 숨기면 1,2,4처럼 구멍이 생겨 버그처럼 보임).
  const TICKET_CATEGORIES = new Set(['공항', '발렛', '숙소'])
  const displaySeqById = new Map<string, number | null>()
  {
    let n = 0
    for (const ev of dayEvents) {
      displaySeqById.set(ev.id, TICKET_CATEGORIES.has(ev.place.category) ? null : ++n)
    }
  }
  const dayTransit = transit.filter((t) => t.dayNumber === day)
  const transitAfter = (eventId: string | null) => dayTransit.filter((t) => t.afterEventId === eventId)
  const expensesByEvent = new Map<string, Expense[]>()
  for (const exp of expenses) {
    if (!exp.eventId) continue
    const list = expensesByEvent.get(exp.eventId) ?? []
    list.push(exp)
    expensesByEvent.set(exp.eventId, list)
  }

  const dayCityInfo = (d: number): { label: string; flags: string } | null => {
    const explicitIds = dayNotes.find((n) => n.dayNumber === d)?.cityIds ?? []
    const explicitCities = explicitIds
      .map((id) => trip.cities.find((c) => c.id === id))
      .filter((c): c is TripCity => !!c)
    if (explicitCities.length > 0) {
      return {
        label: explicitCities.map((c) => c.name).join(', '),
        flags: [...new Set(explicitCities.map((c) => flagEmoji(c.countryCode)))].join(''),
      }
    }
    const evs = events.filter((e) => e.dayNumber === d).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    const cities = evs.map((e) => e.place.cityName).filter((c): c is string => !!c)
    if (cities.length === 0) return null
    const first = cities[0]
    const last = cities[cities.length - 1]
    const codes = [...new Set(evs.map((e) => e.place.countryCode).filter((c): c is string => !!c))]
    return {
      label: first === last ? first : `${first} - ${last}`,
      flags: codes.map((c) => flagEmoji(c)).join('') || '🌆',
    }
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

  const onBulkPhotosPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setBulkUploading(true)
    const res = await api.dayNotes.addPhotosAuto(trip.id, files)
    setBulkUploading(false)
    alert(`📷 ${res.photos.length}장을 촬영일 기준으로 ${res.dayCount}개 일차 일기에 나눠 넣었어요.`)
    refresh()
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

  const transitOriginIdx = dayEvents.findIndex((e) => e.id === transitAfterId)
  const transitDestEvent = transitOriginIdx >= 0 ? dayEvents[transitOriginIdx + 1] : null
  const canAutoCalcTransit = AUTO_CALC_MODES.has(transitMode) && transitOriginIdx >= 0 && !!transitDestEvent

  const autoCalcTransit = async () => {
    if (transitOriginIdx < 0 || !transitDestEvent) return
    setTransitCalculating(true)
    const res = await api.directions.duration(dayEvents[transitOriginIdx].place.id, transitDestEvent.place.id, transitMode)
    setTransitCalculating(false)
    if ('error' in res) { alert(res.error); return }
    setTransitDuration(res.durationText)
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
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="text" value={transitDuration} placeholder="예: 4분" onChange={(e) => setTransitDuration(e.target.value)} />
          {canAutoCalcTransit && (
            <button type="button" className="btn small" onClick={autoCalcTransit} disabled={transitCalculating}>
              {transitCalculating ? '계산 중…' : '🧭 자동'}
            </button>
          )}
        </div>
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
    <div>
      <div className="day-tabs" style={{ marginBottom: 12 }}>
        <button className={`pill ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>📋 리스트</button>
        <button className={`pill ${viewMode === 'board' ? 'active' : ''}`} onClick={() => setViewMode('board')}>🗂 보드</button>
      </div>
      {viewMode === 'board' && (
        <TripBoardView trip={trip} events={events} onChanged={refresh} onOpenDay={(d) => { setDay(d); setViewMode('list') }} />
      )}
      {viewMode === 'list' && (
    <div className="workspace">
      {/* 좌측: 일차 내비게이션 */}
      <div className="day-nav-col">
        {todayNum != null && day !== todayNum && (
          <button type="button" className="btn small primary" onClick={() => setDay(todayNum)}>
            📍 오늘({todayNum}일차)로 이동
          </button>
        )}
        <input ref={bulkPhotoInput} type="file" multiple accept="image/*" hidden onChange={onBulkPhotosPicked} />
        <button type="button" className="btn small" onClick={() => bulkPhotoInput.current?.click()} disabled={bulkUploading}
          title="여러 장을 한번에 올리면 촬영일 기준으로 각 일차 일기에 자동으로 나눠 들어가요">
          {bulkUploading ? '업로드 중…' : '📷 사진 일괄 업로드'}
        </button>
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
          const cityInfo = dayCityInfo(d)
          const spend = computeDailySpend(trip, expenses, d, rates).total
          const note = dayNotes.find((n) => n.dayNumber === d) ?? null
          const status = dailyBudgetStatus(spend, note?.budget ?? null)
          return (
            <div key={d} className={`day-nav-btn ${day === d ? 'active' : ''}`}
              style={{ position: 'relative', cursor: 'pointer' }}
              onClick={() => setDay(d)}>
              <div className="day-nav-content" style={{ paddingRight: 20 }}>
                <div>
                  {d}일차 <span style={{ fontWeight: 400, fontSize: 11 }}>{dayLabel(trip, d)}</span>
                  {note?.weatherEmoji && <span style={{ marginLeft: 4 }}>{note.weatherEmoji}</span>}
                </div>
                {note?.note && <div style={{ fontWeight: 400, fontSize: 11 }}>{note.note}</div>}
                {cityInfo && <div style={{ fontWeight: 400, fontSize: 11 }}>{cityInfo.flags} {cityInfo.label}</div>}
                <div style={{ fontWeight: 400, fontSize: 11 }}>💸 {fmtMoney(spend, 'KRW')}</div>
                {status && <div style={{ fontWeight: 400, fontSize: 11 }}>{status.emoji} {status.label}</div>}
              </div>
              <div style={{ position: 'absolute', top: 2, right: 2 }}>
                <DropdownMenu actions={[
                  { label: '📔 일기', onClick: () => setDiaryDay(d) },
                  { label: '✏️ 수정', onClick: () => setEditingDay(d) },
                ]} />
              </div>
            </div>
            )
        })}
        {editingDay != null && (
          <DayNoteEditModal
            tripId={trip.id}
            dayNumber={editingDay}
            note={dayNotes.find((n) => n.dayNumber === editingDay) ?? null}
            cities={trip.cities}
            onClose={() => setEditingDay(null)}
            onSaved={refresh}
          />
        )}
        {diaryDay != null && (
          <DayDiaryModal
            trip={trip}
            dayNumber={diaryDay}
            note={dayNotes.find((n) => n.dayNumber === diaryDay) ?? null}
            expenses={expenses}
            rates={rates}
            onClose={() => setDiaryDay(null)}
            onChanged={refresh}
            onEdit={() => { setEditingDay(diaryDay); setDiaryDay(null) }}
          />
        )}
      </div>

      {/* 중앙: 오늘 할 일 + 타임라인 */}
      <div>
        {todayNum != null && day === todayNum && (
          <div style={{ marginBottom: 14 }}>
            <TodayStrip
              trip={trip}
              dayNumber={todayNum}
              dayEvents={dayEvents}
              members={members}
              onOpenDiary={() => setDiaryDay(todayNum)}
              onChanged={refresh}
            />
          </div>
        )}
        <ChecklistPanel tripId={trip.id} scope="day" dayNumber={day} title="✅ 오늘 해야할 일" addPlaceholder="예: 호텔 체크인, 유심 개통" />

          <div
            className={`drop-zone ${dayEvents.length === 0 ? 'is-empty' : ''} ${dragOver ? 'drag-over' : ''}`}
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
                  isToday={todayNum != null && day === todayNum}
                  displaySeq={displaySeqById.get(ev.id) ?? null}
                  spentAtDate={dayISODate(trip, ev.dayNumber ?? day)}
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
          <button className={`pill ${rightPanel === 'planb' ? 'active' : ''}`} onClick={() => setRightPanel('planb')}>🌀 PLAN B</button>
          <button className={`pill ${rightPanel === 'map' ? 'active' : ''}`} onClick={() => setRightPanel('map')}>🗺 지도</button>
        </div>
        {rightPanel === 'archive' && <ArchiveBoard tripId={trip.id} />}
        {rightPanel === 'planb' && <PlanBPanel trip={trip} places={places} events={events} day={day} onAdded={refresh} />}
        {rightPanel === 'map' && <MapTab trip={trip} day={day} />}
      </div>
    </div>
      )}
    </div>
  )
}
