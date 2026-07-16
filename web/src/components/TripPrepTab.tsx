import { useEffect, useState } from 'react'
import type { Trip, TimelineEvent, Expense, Member, Place } from '../../shared/types'
import { api } from '../api'
import { fmtMoney } from '../settlement'
import { dayCount } from './TripWorkspace'
import Select from './Select'
import AddExpenseModal from './AddExpenseModal'
import BoardingPassCard from './BoardingPassCard'
import ValetPassCard from './ValetPassCard'
import LodgingPassCard from './LodgingPassCard'
import TicketQuickAdd, { type TicketKind } from './TicketQuickAdd'
import VouchersTab from './VouchersTab'
import ChecklistPanel from './ChecklistPanel'

type PrepSection = 'tickets' | 'vouchers'
const PREP_SECTIONS: Array<{ key: PrepSection; label: string }> = [
  { key: 'tickets', label: '🎟 예약 티켓' },
  { key: 'vouchers', label: '🎫 바우처' },
]

function DayAssignRow({ trip, ev, onAssigned }: { trip: Trip; ev: TimelineEvent; onAssigned: () => void }) {
  const [day, setDay] = useState('1')
  const assign = async () => {
    await api.events.assignDay(trip.id, ev.id, Number(day))
    onAssigned()
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 6px', flexWrap: 'wrap' }}>
      <span className="muted" style={{ fontWeight: 700 }}>📌 아직 일정에 배치 안 됨</span>
      <Select value={day} onChange={(e) => setDay(e.target.value)} style={{ width: 90 }}>
        {Array.from({ length: dayCount(trip) }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>{d}일차</option>
        ))}
      </Select>
      <button className="btn small primary" onClick={assign}>일정에 배치</button>
    </div>
  )
}

export default function TripPrepTab({ trip }: { trip: Trip }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [participants, setParticipants] = useState<Member[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [showAddPrebooked, setShowAddPrebooked] = useState(false)
  const [ticketKind, setTicketKind] = useState<TicketKind | null>(null)
  const [editTicket, setEditTicket] = useState<{ kind: TicketKind; event: TimelineEvent } | null>(null)
  const [section, setSection] = useState<PrepSection>('tickets')

  const refresh = () => {
    api.events.list(trip.id).then(setEvents)
    api.expenses.list(trip.id).then(setExpenses)
    api.tripMembers.list(trip.id).then(setParticipants)
    api.places.list().then(setPlaces)
  }
  useEffect(refresh, [trip.id])

  const byDay = (a: TimelineEvent, b: TimelineEvent) =>
    (a.dayNumber ?? Infinity) - (b.dayNumber ?? Infinity) || (a.sequence ?? 0) - (b.sequence ?? 0)
  const valets = events.filter((e) => e.place.category === '발렛').sort(byDay)
  const flights = events.filter((e) => e.place.category === '공항').sort(byDay)
  const stays = events.filter((e) => e.place.category === '숙소').sort(byDay)
  const standalonePrebooked = expenses.filter((e) => e.eventId === null && e.isPrebooked)

  // 티켓은 "그냥 티켓만" 보여준다. 티켓 위엔 얇은 툴바(미배정이면 배치 컨트롤 + ✏️ 수정)만.
  // (결제 금액은 [💸 지출]·정산에서 관리하므로 티켓 위에 다시 얹지 않는다.)
  const ticketHeader = (kind: TicketKind, ev: TimelineEvent) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
      {ev.dayNumber == null && <DayAssignRow trip={trip} ev={ev} onAssigned={refresh} />}
      <button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={() => setEditTicket({ kind, event: ev })}>
        ✏️ 수정
      </button>
    </div>
  )

  return (
    <div>
      {/* 체크리스트 — 여행 "준비"의 본체라 준비 탭 맨 위에 (예전엔 BASE 탭에 있었음) */}
      <strong style={{ fontSize: 15 }}>✅ 체크리스트</strong>
      <div className="prep-split" style={{ marginTop: 10, marginBottom: 22 }}>
        <ChecklistPanel
          tripId={trip.id}
          scope="predeparture"
          title="🛫 여행 전 Todo"
          addPlaceholder="예: 여행자보험 가입"
        />
        <ChecklistPanel
          tripId={trip.id}
          scope="packing"
          title="🎒 여행 준비물"
          addPlaceholder="예: 여권, 충전기"
        />
      </div>

      <div className="day-tabs prep-sub-tabs" style={{ borderTop: '1.5px solid var(--line)', paddingTop: 18 }}>
        {PREP_SECTIONS.map((s) => (
          <button key={s.key} className={`pill ${section === s.key ? 'active' : ''}`} onClick={() => setSection(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      {section === 'vouchers' && <VouchersTab trip={trip} />}
      {section === 'tickets' && (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>
            발렛·항공·숙소처럼 여행 초반에 미리 예약하는 것들을 한 눈에 모아뒀어요. 일차가 아직 정해지지 않았어도 예약 정보부터
            바로 티켓으로 남겨두고, 나중에 일정에 배치할 수 있어요.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <button className="btn primary small" onClick={() => setTicketKind('발렛')}>＋ 발렛 티켓</button>
            <button className="btn primary small" onClick={() => setTicketKind('항공')}>＋ 항공 티켓</button>
            <button className="btn primary small" onClick={() => setTicketKind('숙소')}>＋ 숙소 티켓</button>
            {participants.length > 0 ? (
              <button className="btn small" onClick={() => setShowAddPrebooked(true)}>＋ 사전예약 지출 추가</button>
            ) : (
              <span className="muted">[💸 지출] 탭에서 참여자를 먼저 추가하면 사전예약 지출도 추가할 수 있어요.</span>
            )}
          </div>
          {ticketKind && (
            <TicketQuickAdd
              tripId={trip.id}
              kind={ticketKind}
              places={places}
              participants={participants}
              existingFlights={flights}
              onClose={() => setTicketKind(null)}
              onCreated={refresh}
            />
          )}
          {editTicket && (
            <TicketQuickAdd
              tripId={trip.id}
              kind={editTicket.kind}
              places={places}
              participants={participants}
              editEvent={editTicket.event}
              onClose={() => setEditTicket(null)}
              onCreated={refresh}
            />
          )}
          {showAddPrebooked && (
            <AddExpenseModal
              trip={trip}
              participants={participants}
              title="사전예약 지출 추가"
              defaultCategory="숙소"
              defaultPrebooked
              onClose={() => setShowAddPrebooked(false)}
              onAdded={() => { setShowAddPrebooked(false); refresh() }}
            />
          )}
          {standalonePrebooked.length > 0 && (
            <div className="section-gap">
              <strong>📌 일정과 상관없는 사전예약 지출</strong>
              {standalonePrebooked.map((e) => (
                <div key={e.id} className="row">
                  <div className="grow">
                    <div style={{ fontWeight: 800 }}>{e.description}</div>
                    <div className="muted">
                      {e.category}
                      {e.paymentMethod && ` · 💳 ${e.paymentMethod}`}
                      {e.memo && ` · 📝 ${e.memo}`}
                    </div>
                  </div>
                  <span className="chip green" style={{ fontWeight: 800 }}>{fmtMoney(e.amount, e.currency)}</span>
                  <button className="x-btn" onClick={() => api.expenses.delete(e.id).then(refresh)}>×</button>
                </div>
              ))}
            </div>
          )}
          {valets.length === 0 && flights.length === 0 && stays.length === 0 ? (
            <div className="empty">위 버튼으로 발렛·항공·숙소 티켓을 추가하면 여기 모아서 보여줘요.</div>
          ) : (
            <>
              {valets.length > 0 && (
                <div className="section-gap">
                  <strong>🚗 발렛</strong>
                  {valets.map((ev) => (
                    <div key={ev.id} style={{ marginTop: 8 }}>
                      {ticketHeader('발렛', ev)}
                      {ev.valet ? (
                        <ValetPassCard valet={ev.valet} placeName={ev.place.name} />
                      ) : (
                        <div className="row"><span className="muted">아직 발렛 상세정보가 없어요.</span></div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {flights.length > 0 && (
                <div className="section-gap">
                  <strong>✈️ 항공</strong>
                  {flights.map((ev) => (
                    <div key={ev.id} style={{ marginTop: 8 }}>
                      {ticketHeader('항공', ev)}
                      {ev.flight ? (
                        <BoardingPassCard flight={ev.flight} fromName={ev.place.name} participants={participants} />
                      ) : (
                        <div className="row"><span className="muted">아직 항공 상세정보가 없어요 — 동선에서 입력해주세요.</span></div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {stays.length > 0 && (
                <div className="section-gap">
                  <strong>🏨 숙소</strong>
                  {stays.map((ev) => (
                    <div key={ev.id} style={{ marginTop: 8 }}>
                      {ticketHeader('숙소', ev)}
                      {ev.lodging ? (
                        <LodgingPassCard lodging={ev.lodging} placeName={ev.place.name} />
                      ) : (
                        <div className="row">
                          <div className="grow">
                            <div style={{ fontWeight: 800 }}>{ev.place.name}</div>
                            {ev.place.address && <div className="muted">📍 {ev.place.address}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
