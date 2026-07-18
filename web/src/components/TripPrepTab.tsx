import { useEffect, useState } from 'react'
import type { Trip, TimelineEvent, Expense, Member, Place, Voucher, Airline } from '../../shared/types'
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
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [airlines, setAirlines] = useState<Airline[]>([])
  const [showAddPrebooked, setShowAddPrebooked] = useState(false)
  const [ticketKind, setTicketKind] = useState<TicketKind | null>(null)
  const [editTicket, setEditTicket] = useState<{ kind: TicketKind; event: TimelineEvent } | null>(null)
  const [section, setSection] = useState<PrepSection>('tickets')

  const refresh = () => {
    api.events.list(trip.id).then(setEvents)
    api.expenses.list(trip.id).then(setExpenses)
    api.tripMembers.list(trip.id).then(setParticipants)
    api.places.list().then(setPlaces)
    api.vouchers.list(trip.id).then(setVouchers)
    api.airlines.list().then(setAirlines)
  }
  useEffect(refresh, [trip.id])

  const byDay = (a: TimelineEvent, b: TimelineEvent) =>
    (a.dayNumber ?? Infinity) - (b.dayNumber ?? Infinity) || (a.sequence ?? 0) - (b.sequence ?? 0)
  const valets = events.filter((e) => e.place.category === '발렛').sort(byDay)
  const flights = events.filter((e) => e.place.category === '공항').sort(byDay)
  const stays = events.filter((e) => e.place.category === '숙소').sort(byDay)
  const standalonePrebooked = expenses.filter((e) => e.eventId === null && e.isPrebooked)

  // 티켓 카드(영수증 모양) 자체를 누르면 수정. 미배정이면 위에 배치 컨트롤만.
  const ticketCell = (kind: TicketKind, ev: TimelineEvent, pass: React.ReactNode, emptyLabel: string) => (
    <div key={ev.id}>
      {ev.dayNumber == null && (
        <div style={{ marginBottom: 4 }}><DayAssignRow trip={trip} ev={ev} onAssigned={refresh} /></div>
      )}
      {pass ? (
        <div className="ticket-clickable" role="button" title="눌러서 수정" onClick={() => setEditTicket({ kind, event: ev })}>
          {pass}
        </div>
      ) : (
        <button className="btn small primary" style={{ width: '100%' }} onClick={() => setEditTicket({ kind, event: ev })}>
          ＋ {emptyLabel}
        </button>
      )}
    </div>
  )

  const ticketSection = (
    kind: TicketKind, eng: string, label: string, items: TimelineEvent[],
    renderPass: (ev: TimelineEvent) => React.ReactNode, emptyLabel: string,
  ) => (
    <div className="prep-sec">
      <div className="base-list-eng">{eng}</div>
      <div className="prep-sec-head">
        <strong>{label}</strong>
        {items.length > 0 && <span className="chip">{items.length}</span>}
        <span className="grow" />
        <button className="btn small ghost" onClick={() => setTicketKind(kind)}>＋ 추가</button>
      </div>
      {items.length === 0 ? (
        <div className="muted prep-sec-empty">아직 없어요. 오른쪽 [＋ 추가]로 남겨보세요.</div>
      ) : (
        <div className="prep-ticket-grid">
          {items.map((ev) => ticketCell(kind, ev, renderPass(ev), emptyLabel))}
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div className="day-tabs prep-sub-tabs">
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
            바로 티켓으로 남겨두고, 나중에 일정에 배치할 수 있어요. 티켓을 누르면 수정할 수 있어요.
          </p>
          {ticketKind && (
            <TicketQuickAdd
              tripId={trip.id}
              kind={ticketKind}
              places={places}
              participants={participants}
              existingFlights={flights}
              airlines={airlines}
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
              airlines={airlines}
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
          {ticketSection('항공', 'FLIGHT', '✈️ 항공', flights,
            (ev) => ev.flight
              ? <BoardingPassCard flight={ev.flight} fromName={ev.place.name} fromAirportCode={ev.place.airportCode} participants={participants} vouchers={vouchers} />
              : null,
            '항공 상세정보 입력')}

          {ticketSection('숙소', 'STAY', '🏨 숙소', stays,
            (ev) => ev.lodging
              ? <LodgingPassCard lodging={ev.lodging} place={ev.place} vouchers={vouchers} />
              : null,
            '숙소 상세정보 입력')}

          {ticketSection('발렛', 'VALET', '🚗 발렛', valets,
            (ev) => ev.valet
              ? <ValetPassCard valet={ev.valet} place={ev.place} vouchers={vouchers} />
              : null,
            '발렛 상세정보 입력')}

          <div className="prep-sec">
            <div className="base-list-eng">PREBOOKED</div>
            <div className="prep-sec-head">
              <strong>📌 사전예약 지출</strong>
              {standalonePrebooked.length > 0 && <span className="chip">{standalonePrebooked.length}</span>}
              <span className="grow" />
              {participants.length > 0 && (
                <button className="btn small ghost" onClick={() => setShowAddPrebooked(true)}>＋ 추가</button>
              )}
            </div>
            {participants.length === 0 ? (
              <div className="muted prep-sec-empty">[💸 지출] 탭에서 참여자를 먼저 추가하면 사전예약 지출도 추가할 수 있어요.</div>
            ) : standalonePrebooked.length === 0 ? (
              <div className="muted prep-sec-empty">항공권·숙소 결제처럼 일정과 무관하게 미리 나간 지출을 여기 남겨요.</div>
            ) : (
              standalonePrebooked.map((e) => (
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
              ))
            )}
          </div>
        </div>
      )}

      {/* 체크리스트 — 티켓·바우처 아래로 내림 (구분선/제목 대신 단청 악센트 띠) */}
      <div style={{ marginTop: 26 }}>
        <div className="dancheong-divider" />
        <div className="prep-split" style={{ marginTop: 16 }}>
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
      </div>
    </div>
  )
}
