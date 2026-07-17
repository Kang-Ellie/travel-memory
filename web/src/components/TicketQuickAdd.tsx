import { useRef, useState } from 'react'
import type { Place, Member, VoucherCategory, TimelineEvent } from '../../shared/types'
import { api } from '../api'
import { fmtDateTime } from '../categories'
import Modal from './Modal'
import Select from './Select'
import DateTimePicker from './DateTimePicker'

export type TicketKind = '발렛' | '항공' | '숙소'

const TICKET_ICON: Record<TicketKind, string> = { 발렛: '🚗', 항공: '✈️', 숙소: '🏨' }
// 항공 티켓의 장소는 "항공"이 아니라 "공항" 카테고리로 등록해야 장소 족보·여행 준비 탭의
// 공항 필터([TripPrepTab.tsx]의 category === '공항')와 맞물린다.
const CATEGORY_FOR_KIND: Record<TicketKind, string> = { 발렛: '발렛', 항공: '공항', 숙소: '숙소' }
// "이름"은 항공/발렛이면 티켓 자체가 아니라 그 티켓이 속한 장소(공항, 발렛 맡기는 곳)의 이름이라
// 라벨을 명확히 구분해준다. 항공은 터미널 단위로 쪼개지 않고 공항 단위로 등록해야 여러 여행에서
// 재사용되고 리뷰·방문기록이 한 곳에 쌓인다 — 터미널처럼 매번 바뀔 수 있는 정보는 출발장소에 적는다.
const NAME_LABEL: Record<TicketKind, string> = { 발렛: '발렛 맡기는 곳 이름', 항공: '공항 이름', 숙소: '숙소명' }
const VOUCHER_CATEGORY_FOR_KIND: Record<TicketKind, VoucherCategory> = { 발렛: '티켓', 항공: '항공권', 숙소: '숙소' }

export default function TicketQuickAdd({
  tripId, kind, places, participants, existingFlights = [], editEvent, onClose, onCreated,
}: {
  tripId: string; kind: TicketKind; places: Place[]; participants: Member[]; existingFlights?: TimelineEvent[]
  editEvent?: TimelineEvent; onClose: () => void; onCreated: () => void
}) {
  const isEdit = !!editEvent
  const f = editEvent?.flight
  const va = editEvent?.valet
  const lo = editEvent?.lodging
  const candidatePlaces = places.filter((p) => p.category === CATEGORY_FOR_KIND[kind])
  const copyableFlights = existingFlights.filter((e) => e.flight)
  const [placeId, setPlaceId] = useState(editEvent?.placeId ?? '')
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newAirportCode, setNewAirportCode] = useState('')

  const [scheduledAt, setScheduledAt] = useState(va?.scheduledAt ?? '')
  const [location, setLocation] = useState(va?.location ?? '')
  const [company, setCompany] = useState(va?.company ?? '')

  const [departAt, setDepartAt] = useState(f?.departAt ?? '')
  const [arriveAt, setArriveAt] = useState(f?.arriveAt ?? '')
  const [departureLocation, setDepartureLocation] = useState(f?.departureLocation ?? '')
  const [destination, setDestination] = useState(f?.destination ?? '')
  const [destinationPlaceId, setDestinationPlaceId] = useState(f?.destinationPlaceId ?? '')
  // 수정 모드에서 등록된 도착지 없이 자유 입력 텍스트만 있던 옛날 티켓이면, 그 텍스트를
  // "새 공항 등록" 이름칸에 미리 채워둬서 코드만 추가하고 저장하면 바로 장소로 승격되게 한다.
  const [newDestName, setNewDestName] = useState(f && !f.destinationPlaceId ? (f.destination ?? '') : '')
  const [newDestAddress, setNewDestAddress] = useState('')
  const [newDestAirportCode, setNewDestAirportCode] = useState('')
  const [airline, setAirline] = useState(f?.airline ?? '')
  const [flightNo, setFlightNo] = useState(f?.flightNo ?? '')
  const [passengerIds, setPassengerIds] = useState<Set<string>>(
    new Set(f?.passengerIds?.length ? f.passengerIds : participants.map((p) => p.id)),
  )

  const [checkInAt, setCheckInAt] = useState(lo?.checkInAt ?? '')
  const [checkOutAt, setCheckOutAt] = useState(lo?.checkOutAt ?? '')
  const [breakfastIncluded, setBreakfastIncluded] = useState(lo?.breakfastIncluded ?? false)
  const [roomType, setRoomType] = useState(lo?.roomType ?? '')

  const [bookingRef, setBookingRef] = useState(f?.bookingRef ?? va?.bookingRef ?? lo?.bookingRef ?? '')
  const [bookedVia, setBookedVia] = useState(f?.bookedVia ?? va?.bookedVia ?? lo?.bookedVia ?? '')
  const [confirmed, setConfirmed] = useState(f?.confirmed ?? va?.confirmed ?? lo?.confirmed ?? false)
  const [saving, setSaving] = useState(false)
  const [voucherFile, setVoucherFile] = useState<File | null>(null)
  const voucherInput = useRef<HTMLInputElement>(null)
  const [showDetail, setShowDetail] = useState(isEdit)

  // 가족이 같은 비행기를 따로 예약했을 때: 이미 등록된 항공편에서 시간·출발지·도착지·항공사 정보를 그대로 가져오고,
  // 탑승자는 그 항공편에 이미 들어간 사람을 뺀 나머지로 기본 선택해준다(따로 산 사람들이니까).
  const copyFlightInfo = (eventId: string) => {
    const source = copyableFlights.find((e) => e.id === eventId)
    if (!source?.flight) return
    setDepartAt(source.flight.departAt ?? '')
    setArriveAt(source.flight.arriveAt ?? '')
    setDepartureLocation(source.flight.departureLocation ?? '')
    setDestination(source.flight.destination ?? '')
    setDestinationPlaceId(source.flight.destinationPlaceId ?? '')
    setAirline(source.flight.airline ?? '')
    setFlightNo(source.flight.flightNo ?? '')
    const covered = new Set(source.flight.passengerIds)
    setPassengerIds(new Set(participants.filter((p) => !covered.has(p.id)).map((p) => p.id)))
  }

  const submit = async () => {
    let resolvedPlaceId = placeId
    if (!isEdit && !resolvedPlaceId) {
      if (!newName.trim()) return
      const p = await api.places.create({
        name: newName.trim(), address: newAddress.trim(), category: CATEGORY_FOR_KIND[kind],
        airportCode: kind === '항공' ? (newAirportCode.trim() || null) : undefined,
      })
      resolvedPlaceId = p.id
    }
    let resolvedDestinationPlaceId: string | null = destinationPlaceId && destinationPlaceId !== '__new__' ? destinationPlaceId : null
    if (kind === '항공' && destinationPlaceId === '__new__' && newDestName.trim()) {
      const dp = await api.places.create({
        name: newDestName.trim(), address: newDestAddress.trim(), category: '공항',
        airportCode: newDestAirportCode.trim() || null,
      })
      resolvedDestinationPlaceId = dp.id
    }
    setSaving(true)
    // 수정 모드: 새 파일을 안 올렸으면 기존 바우처 연결을 그대로 유지한다.
    let voucherId: string | null = isEdit ? (f?.voucherId ?? va?.voucherId ?? lo?.voucherId ?? null) : null
    let voucherTitle: string | null = isEdit ? (f?.voucherTitle ?? va?.voucherTitle ?? lo?.voucherTitle ?? null) : null
    if (voucherFile) {
      const [voucher] = await api.vouchers.add(tripId, [voucherFile], VOUCHER_CATEGORY_FOR_KIND[kind])
      voucherId = voucher.id
      voucherTitle = voucher.title
    }
    const eventId = isEdit ? editEvent!.id : (await api.events.create({ tripId, placeId: resolvedPlaceId, dayNumber: null })).id
    if (kind === '발렛') {
      await api.events.setValet(eventId, {
        scheduledAt: scheduledAt || null, location: location.trim() || null, company: company.trim() || null,
        bookedVia: bookedVia.trim() || null, bookingRef: bookingRef.trim() || null, confirmed,
        voucherId, voucherTitle, note: va?.note ?? null,
      })
    } else if (kind === '항공') {
      await api.events.setFlight(eventId, {
        // 이 폼에 없는 필드(소요시간·게이트·좌석·로고)는 수정 모드에서 기존 값 보존
        departAt: departAt || null, arriveAt: arriveAt || null, durationMinutes: f?.durationMinutes ?? null,
        bookingRef: bookingRef.trim() || null, bookedVia: bookedVia.trim() || null,
        departureLocation: departureLocation.trim() || null, confirmed,
        voucherId, voucherTitle,
        airline: airline.trim() || null, airlineLogoPath: f?.airlineLogoPath ?? null, flightNo: flightNo.trim() || null,
        destination: destination.trim() || null, destinationPlaceId: resolvedDestinationPlaceId,
        gate: f?.gate ?? null, seat: f?.seat ?? null,
        passengerIds: [...passengerIds],
      })
    } else {
      await api.events.setLodging(eventId, {
        checkInAt: checkInAt || null, checkOutAt: checkOutAt || null,
        bookingRef: bookingRef.trim() || null, bookedVia: bookedVia.trim() || null, confirmed,
        voucherId, voucherTitle, note: lo?.note ?? null,
        breakfastIncluded, roomType: roomType.trim() || null,
      })
    }
    setSaving(false)
    onCreated()
    onClose()
  }

  const bookingFields = (
    <>
      <div className="form-row">
        <div className="field"><label>예약번호</label>
          <input type="text" value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} /></div>
        <div className="field grow"><label>예약처</label>
          <input type="text" value={bookedVia} placeholder="예: 부킹닷컴" onChange={(e) => setBookedVia(e.target.value)} /></div>
        <label className="row" style={{ border: 'none', padding: 0, gap: 6, alignItems: 'center', width: 'auto' }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          ✅ 예약 확정
        </label>
      </div>
      <div className="field grow" style={{ marginBottom: 12 }}>
        <label>🎫 바우처 파일 (선택 · PDF·이미지)</label>
        <input ref={voucherInput} type="file" accept=".pdf,image/*" hidden
          onChange={(e) => setVoucherFile(e.target.files?.[0] ?? null)} />
        <button type="button" className="btn small" onClick={() => voucherInput.current?.click()}>
          {voucherFile ? `📎 ${voucherFile.name}` : '📎 파일 선택'}
        </button>
        {voucherFile && (
          <button type="button" className="btn small ghost" style={{ marginLeft: 6 }} onClick={() => setVoucherFile(null)}>
            취소
          </button>
        )}
      </div>
    </>
  )

  return (
    <Modal title={`${TICKET_ICON[kind]} ${kind} 티켓 ${isEdit ? '수정' : '추가'}`} onClose={onClose}>
      {isEdit ? (
        <p className="muted" style={{ marginTop: 0 }}>
          <strong>{editEvent!.place.name}</strong> 티켓의 예약 정보를 수정해요.
        </p>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            아직 몇 일차인지 몰라도 먼저 예약 정보부터 기록해두고, 나중에 일정에 배치할 수 있어요.
          </p>
          <div className="form-row">
            <div className="field grow">
              <label>{kind === '항공' ? '장소 (공항 — 같은 공항이면 재사용하세요)' : '장소'}</label>
              <Select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
                <option value="">✚ 새 장소 바로 등록</option>
                {candidatePlaces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
            {!placeId && (
              <>
                <div className="field grow">
                  <label>{NAME_LABEL[kind]}</label>
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`예: ${kind === '항공' ? '인천국제공항' : kind === '숙소' ? '호텔명' : '인천공항 T1 단기주차장'}`} />
                </div>
                {kind === '항공' && (
                  <div className="field" style={{ maxWidth: 110 }}>
                    <label>✈️ 공항 코드</label>
                    <input type="text" value={newAirportCode} maxLength={4} placeholder="예: ICN"
                      onChange={(e) => setNewAirportCode(e.target.value.toUpperCase())} />
                  </div>
                )}
                <div className="field grow">
                  <label>주소 (선택)</label>
                  <input type="text" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="주소" />
                </div>
              </>
            )}
          </div>
        </>
      )}

      {kind === '발렛' && (
        <div className="form-row">
          <div className="field"><label>예정 시간</label>
            <DateTimePicker value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></div>
          <div className="field grow"><label>위치</label>
            <input type="text" value={location} placeholder="예: 단기주차장 지하1층 A구역" onChange={(e) => setLocation(e.target.value)} /></div>
          <div className="field grow"><label>발렛사</label>
            <input type="text" value={company} placeholder="예: 투루발렛" onChange={(e) => setCompany(e.target.value)} /></div>
        </div>
      )}

      {kind === '항공' && (
        <div className="form-row">
          {copyableFlights.length > 0 && (
            <div className="field grow">
              <label>🔁 가족이 같은 비행기를 따로 예약했나요? 기존 항공편에서 정보 복사</label>
              <Select value="" onChange={(e) => e.target.value && copyFlightInfo(e.target.value)}>
                <option value="">— 선택 안 함 —</option>
                {copyableFlights.map((e) => {
                  const dep = fmtDateTime(e.flight?.departAt ?? null)
                  const to = e.flight?.destinationPlaceName ?? e.flight?.destination
                  return (
                    <option key={e.id} value={e.id}>
                      {e.place.name}{to ? ` → ${to}` : ''} · {dep.date} {dep.time}
                    </option>
                  )
                })}
              </Select>
            </div>
          )}
          <div className="field grow"><label>🛫 출발장소 상세 (선택 · 터미널 등)</label>
            <input type="text" value={departureLocation} placeholder="예: T2, 3층 F카운터" onChange={(e) => setDepartureLocation(e.target.value)} /></div>
          <div className="field grow">
            <label>도착지 (공항 — 재사용하려면 등록해두세요, 선택)</label>
            <Select value={destinationPlaceId} onChange={(e) => setDestinationPlaceId(e.target.value)}>
              <option value="">— 선택 안 함 (아래 자유 입력만 사용) —</option>
              <option value="__new__">✚ 새 공항 등록</option>
              {candidatePlaces.map((p) => <option key={p.id} value={p.id}>{p.name}{p.airportCode ? ` (${p.airportCode})` : ''}</option>)}
            </Select>
          </div>
          {destinationPlaceId === '__new__' && (
            <>
              <div className="field grow">
                <label>공항 이름</label>
                <input type="text" value={newDestName} placeholder="예: 간사이국제공항" onChange={(e) => setNewDestName(e.target.value)} />
              </div>
              <div className="field" style={{ maxWidth: 110 }}>
                <label>✈️ 공항 코드</label>
                <input type="text" value={newDestAirportCode} maxLength={4} placeholder="예: KIX"
                  onChange={(e) => setNewDestAirportCode(e.target.value.toUpperCase())} />
              </div>
              <div className="field grow">
                <label>주소 (선택)</label>
                <input type="text" value={newDestAddress} onChange={(e) => setNewDestAddress(e.target.value)} placeholder="주소" />
              </div>
            </>
          )}
          <div className="field grow"><label>도착지 상세 (선택)</label>
            <input type="text" value={destination} placeholder="예: 나리타 (NRT)" onChange={(e) => setDestination(e.target.value)} /></div>
          <div className="field"><label>✈️ 출발시간</label>
            <DateTimePicker value={departAt} onChange={(e) => setDepartAt(e.target.value)} /></div>
          <div className="field"><label>🛬 도착시간</label>
            <DateTimePicker value={arriveAt} onChange={(e) => setArriveAt(e.target.value)} /></div>
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

      {kind === '항공' && (
        <>
          <button type="button" className="btn small ghost" onClick={() => setShowDetail((v) => !v)}>
            {showDetail ? '▲ 간단히' : '▼ 자세히 (항공사·편명·예약정보·바우처)'}
          </button>
          {showDetail && (
            <>
              <div className="ticket-stub-divider" />
              <div className="form-row">
                <div className="field"><label>항공사</label>
                  <input type="text" value={airline} placeholder="예: 진에어" onChange={(e) => setAirline(e.target.value)} /></div>
                <div className="field"><label>편명</label>
                  <input type="text" value={flightNo} placeholder="예: LJ203" onChange={(e) => setFlightNo(e.target.value)} /></div>
              </div>
              {bookingFields}
            </>
          )}
        </>
      )}

      {kind === '숙소' && (
        <div className="form-row">
          <div className="field"><label>체크인</label>
            <DateTimePicker value={checkInAt} onChange={(e) => setCheckInAt(e.target.value)} /></div>
          <div className="field"><label>체크아웃</label>
            <DateTimePicker value={checkOutAt} onChange={(e) => setCheckOutAt(e.target.value)} /></div>
          <div className="field grow"><label>🛏 룸 타입</label>
            <input type="text" value={roomType} placeholder="예: 디럭스 더블룸" onChange={(e) => setRoomType(e.target.value)} /></div>
          <label className="row" style={{ border: 'none', padding: 0, gap: 6, alignItems: 'center', width: 'auto' }}>
            <input type="checkbox" checked={breakfastIncluded} onChange={(e) => setBreakfastIncluded(e.target.checked)} />
            🍳 조식 포함
          </label>
        </div>
      )}

      {kind !== '항공' && bookingFields}

      <div style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={submit} disabled={saving}>
          {saving ? '저장 중…' : isEdit ? '저장' : `＋ ${kind} 티켓 추가`}
        </button>
      </div>
    </Modal>
  )
}
