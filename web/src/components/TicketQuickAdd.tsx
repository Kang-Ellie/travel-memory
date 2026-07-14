import { useState } from 'react'
import type { Place, Member } from '../../shared/types'
import { api } from '../api'
import Modal from './Modal'
import Select from './Select'
import DateTimePicker from './DateTimePicker'

export type TicketKind = '발렛' | '항공' | '숙소'

const TICKET_ICON: Record<TicketKind, string> = { 발렛: '🚗', 항공: '✈️', 숙소: '🏨' }
// 항공 티켓의 장소는 "항공"이 아니라 "공항" 카테고리로 등록해야 장소 족보·여행 준비 탭의
// 공항 필터([TripPrepTab.tsx]의 category === '공항')와 맞물린다.
const CATEGORY_FOR_KIND: Record<TicketKind, string> = { 발렛: '발렛', 항공: '공항', 숙소: '숙소' }

export default function TicketQuickAdd({
  tripId, kind, places, participants, onClose, onCreated,
}: {
  tripId: string; kind: TicketKind; places: Place[]; participants: Member[]
  onClose: () => void; onCreated: () => void
}) {
  const candidatePlaces = places.filter((p) => p.category === CATEGORY_FOR_KIND[kind])
  const [placeId, setPlaceId] = useState('')
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')

  const [scheduledAt, setScheduledAt] = useState('')
  const [location, setLocation] = useState('')
  const [company, setCompany] = useState('')

  const [departAt, setDepartAt] = useState('')
  const [arriveAt, setArriveAt] = useState('')
  const [departureLocation, setDepartureLocation] = useState('')
  const [destination, setDestination] = useState('')
  const [airline, setAirline] = useState('')
  const [flightNo, setFlightNo] = useState('')
  const [passengerIds, setPassengerIds] = useState<Set<string>>(new Set(participants.map((p) => p.id)))

  const [checkInAt, setCheckInAt] = useState('')
  const [checkOutAt, setCheckOutAt] = useState('')

  const [bookingRef, setBookingRef] = useState('')
  const [bookedVia, setBookedVia] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    let resolvedPlaceId = placeId
    if (!resolvedPlaceId) {
      if (!newName.trim()) return
      const p = await api.places.create({ name: newName.trim(), address: newAddress.trim(), category: CATEGORY_FOR_KIND[kind] })
      resolvedPlaceId = p.id
    }
    setSaving(true)
    const { id: eventId } = await api.events.create({ tripId, placeId: resolvedPlaceId, dayNumber: null })
    if (kind === '발렛') {
      await api.events.setValet(eventId, {
        scheduledAt: scheduledAt || null, location: location.trim() || null, company: company.trim() || null,
        bookedVia: bookedVia.trim() || null, bookingRef: bookingRef.trim() || null, confirmed,
        voucherId: null, voucherTitle: null, note: null,
      })
    } else if (kind === '항공') {
      await api.events.setFlight(eventId, {
        departAt: departAt || null, arriveAt: arriveAt || null, durationMinutes: null,
        bookingRef: bookingRef.trim() || null, bookedVia: bookedVia.trim() || null,
        departureLocation: departureLocation.trim() || null, confirmed,
        voucherId: null, voucherTitle: null,
        airline: airline.trim() || null, airlineLogoPath: null, flightNo: flightNo.trim() || null,
        destination: destination.trim() || null, gate: null, seat: null,
        passengerIds: [...passengerIds],
      })
    } else {
      await api.events.setLodging(eventId, {
        checkInAt: checkInAt || null, checkOutAt: checkOutAt || null,
        bookingRef: bookingRef.trim() || null, bookedVia: bookedVia.trim() || null, confirmed,
        voucherId: null, voucherTitle: null, note: null,
      })
    }
    setSaving(false)
    onCreated()
    onClose()
  }

  return (
    <Modal title={`${TICKET_ICON[kind]} ${kind} 티켓 추가`} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        아직 몇 일차인지 몰라도 먼저 예약 정보부터 기록해두고, 나중에 일정에 배치할 수 있어요.
      </p>
      <div className="form-row">
        <div className="field grow">
          <label>장소</label>
          <Select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
            <option value="">✚ 새 장소 바로 등록</option>
            {candidatePlaces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        {!placeId && (
          <>
            <div className="field grow">
              <label>이름</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`예: ${kind === '항공' ? '인천국제공항 제1여객터미널' : kind === '숙소' ? '호텔명' : '인천공항 T1 단기주차장'}`} />
            </div>
            <div className="field grow">
              <label>주소 (선택)</label>
              <input type="text" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="주소" />
            </div>
          </>
        )}
      </div>

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
          <div className="field grow"><label>🛫 출발장소</label>
            <input type="text" value={departureLocation} placeholder="예: 인천공항 T2" onChange={(e) => setDepartureLocation(e.target.value)} /></div>
          <div className="field grow"><label>도착지</label>
            <input type="text" value={destination} placeholder="예: 나리타 (NRT)" onChange={(e) => setDestination(e.target.value)} /></div>
          <div className="field"><label>✈️ 출발시간</label>
            <DateTimePicker value={departAt} onChange={(e) => setDepartAt(e.target.value)} /></div>
          <div className="field"><label>🛬 도착시간</label>
            <DateTimePicker value={arriveAt} onChange={(e) => setArriveAt(e.target.value)} /></div>
          <div className="field"><label>항공사</label>
            <input type="text" value={airline} placeholder="예: 진에어" onChange={(e) => setAirline(e.target.value)} /></div>
          <div className="field"><label>편명</label>
            <input type="text" value={flightNo} placeholder="예: LJ203" onChange={(e) => setFlightNo(e.target.value)} /></div>
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

      {kind === '숙소' && (
        <div className="form-row">
          <div className="field"><label>체크인</label>
            <DateTimePicker value={checkInAt} onChange={(e) => setCheckInAt(e.target.value)} /></div>
          <div className="field"><label>체크아웃</label>
            <DateTimePicker value={checkOutAt} onChange={(e) => setCheckOutAt(e.target.value)} /></div>
        </div>
      )}

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

      <div style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={submit} disabled={saving}>
          {saving ? '저장 중…' : `＋ ${kind} 티켓 추가`}
        </button>
      </div>
    </Modal>
  )
}
