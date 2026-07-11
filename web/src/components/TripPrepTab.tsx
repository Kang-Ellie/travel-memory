import { useEffect, useState } from 'react'
import type { Trip, TimelineEvent, Expense, Member, Place } from '../../shared/types'
import { api } from '../api'
import { fmtMoney } from '../settlement'
import { dayCount } from './TripWorkspace'
import Window from './Window'
import Select from './Select'
import AddExpenseModal from './AddExpenseModal'
import BoardingPassCard from './BoardingPassCard'
import ValetPassCard from './ValetPassCard'
import LodgingPassCard from './LodgingPassCard'
import TicketQuickAdd, { type TicketKind } from './TicketQuickAdd'
import FolderIcon from './FolderIcon'
import VouchersTab from './VouchersTab'

type PrepSection = 'tickets' | 'vouchers'

function DayAssignRow({ trip, ev, onAssigned }: { trip: Trip; ev: TimelineEvent; onAssigned: () => void }) {
  const [day, setDay] = useState('1')
  const assign = async () => {
    await api.events.assignDay(trip.id, ev.id, Number(day))
    onAssigned()
  }
  return (
    <div className="row" style={{ marginBottom: 6, background: 'var(--yellow-soft)' }}>
      <span className="chip yellow">📌 일차 미배정</span>
      <span className="grow" />
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
  const prebookedForEvent = (eventId: string) => expenses.some((e) => e.eventId === eventId && e.isPrebooked)
  const standalonePrebooked = expenses.filter((e) => e.eventId === null && e.isPrebooked)

  return (
    <div>
      <div className="folder-tabs">
        <button className={`folder-tab ${section === 'tickets' ? 'active' : ''}`} onClick={() => setSection('tickets')}>
          <FolderIcon color="blue" />
          <span>예약 티켓</span>
        </button>
        <button className={`folder-tab ${section === 'vouchers' ? 'active' : ''}`} onClick={() => setSection('vouchers')}>
          <FolderIcon color="yellow" />
          <span>바우처</span>
        </button>
      </div>
      {section === 'vouchers' && <VouchersTab trip={trip} />}
      {section === 'tickets' && (
        <Window title="PREBOOKED.EXE" color="blue">
        <p className="muted" style={{ marginTop: 0 }}>
          발렛·항공·숙소처럼 여행 초반에 미리 예약하는 것들을 한 눈에 모아뒀어요. 일차가 아직 정해지지 않았어도 예약 정보부터
          바로 티켓으로 남겨두고, 나중에 일정에 배치할 수 있어요.
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn primary small" onClick={() => setTicketKind('발렛')}>＋ 발렛 티켓</button>
          <button className="btn primary small" onClick={() => setTicketKind('항공')}>＋ 항공 티켓</button>
          <button className="btn primary small" onClick={() => setTicketKind('숙소')}>＋ 숙소 티켓</button>
          {participants.length > 0 ? (
            <button className="btn small" onClick={() => setShowAddPrebooked(true)}>＋ 사전예약 지출 추가</button>
          ) : (
            <span className="muted">[🧮 정산] 탭에서 참여자를 먼저 추가하면 사전예약 지출도 추가할 수 있어요.</span>
          )}
        </div>
        {ticketKind && (
          <TicketQuickAdd
            tripId={trip.id}
            kind={ticketKind}
            places={places}
            onClose={() => setTicketKind(null)}
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
                    {ev.dayNumber == null ? (
                      <DayAssignRow trip={trip} ev={ev} onAssigned={refresh} />
                    ) : (
                      <div className="row" style={{ marginBottom: 6 }}>
                        <span className="chip blue">{ev.dayNumber}일차</span>
                        <span className="grow" />
                        <span className={`chip ${prebookedForEvent(ev.id) ? 'green' : 'yellow'}`}>
                          {prebookedForEvent(ev.id) ? '💳 결제 기록됨' : '결제 미기록'}
                        </span>
                      </div>
                    )}
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
                    {ev.dayNumber == null ? (
                      <DayAssignRow trip={trip} ev={ev} onAssigned={refresh} />
                    ) : (
                      <div className="row" style={{ marginBottom: 6 }}>
                        <span className="chip blue">{ev.dayNumber}일차</span>
                        <span className="grow" />
                        <span className={`chip ${prebookedForEvent(ev.id) ? 'green' : 'yellow'}`}>
                          {prebookedForEvent(ev.id) ? '💳 결제 기록됨' : '결제 미기록'}
                        </span>
                      </div>
                    )}
                    {ev.flight ? (
                      <BoardingPassCard flight={ev.flight} fromName={ev.place.name} />
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
                    {ev.dayNumber == null ? (
                      <DayAssignRow trip={trip} ev={ev} onAssigned={refresh} />
                    ) : (
                      <div className="row" style={{ marginBottom: 6 }}>
                        <span className="chip blue">{ev.dayNumber}일차</span>
                        <span className="grow" />
                        <span className={`chip ${prebookedForEvent(ev.id) ? 'green' : 'yellow'}`}>
                          {prebookedForEvent(ev.id) ? '💳 결제 기록됨' : '결제 미기록'}
                        </span>
                      </div>
                    )}
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
      </Window>
      )}
    </div>
  )
}
