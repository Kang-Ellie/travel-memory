import { useEffect, useState } from 'react'
import type { Trip, TimelineEvent, Expense, Member } from '../../shared/types'
import { api } from '../api'
import { fmtMoney } from '../settlement'
import Window from './Window'
import ChecklistPanel from './ChecklistPanel'
import AddExpenseModal from './AddExpenseModal'

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}시간${m > 0 ? ` ${m}분` : ''}` : `${m}분`
}

function fmtDateTime(v: string | null): string {
  if (!v) return '?'
  return new Date(v).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function TripPrepTab({ trip }: { trip: Trip }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [participants, setParticipants] = useState<Member[]>([])
  const [showAddPrebooked, setShowAddPrebooked] = useState(false)

  const refresh = () => {
    api.events.list(trip.id).then(setEvents)
    api.expenses.list(trip.id).then(setExpenses)
    api.tripMembers.list(trip.id).then(setParticipants)
  }
  useEffect(refresh, [trip.id])

  const byDay = (a: TimelineEvent, b: TimelineEvent) => a.dayNumber - b.dayNumber || a.sequence - b.sequence
  const flights = events.filter((e) => e.place.category === '공항').sort(byDay)
  const stays = events.filter((e) => e.place.category === '숙소').sort(byDay)
  const prebookedForEvent = (eventId: string) => expenses.some((e) => e.eventId === eventId && e.isPrebooked)
  const standalonePrebooked = expenses.filter((e) => e.eventId === null && e.isPrebooked)

  return (
    <div>
      <Window title="PREBOOKED.EXE" color="blue">
        <p className="muted" style={{ marginTop: 0 }}>
          항공·숙소처럼 미리 예약/결제하는 것들을 한 눈에 모아뒀어요. 아직 동선에 일정을 넣지 않았어도, 왕복 항공권이나 숙소 예약금처럼
          일정과 상관없이 지출부터 기록하고 싶다면 아래에서 바로 추가하세요. (동선에 일정을 넣고 [비용 기록]에서 "사전예약"으로
          표시해도 여기 자동으로 모여요)
        </p>
        <div className="row">
          {participants.length > 0 ? (
            <button className="btn primary small" onClick={() => setShowAddPrebooked(true)}>＋ 사전예약 지출 추가</button>
          ) : (
            <span className="muted">[🧮 정산] 탭에서 참여자를 먼저 추가하세요.</span>
          )}
        </div>
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
                <button className="btn small ghost" onClick={() => api.expenses.delete(e.id).then(refresh)}>×</button>
              </div>
            ))}
          </div>
        )}
        {flights.length === 0 && stays.length === 0 ? (
          <div className="empty">동선에 항공(공항)·숙소 일정을 추가하면 여기 모아서 보여줘요.</div>
        ) : (
          <>
            {flights.length > 0 && (
              <div className="section-gap">
                <strong>✈️ 항공</strong>
                {flights.map((ev) => (
                  <div key={ev.id} className="row">
                    <span className="chip blue">{ev.dayNumber}일차</span>
                    <div className="grow">
                      <div style={{ fontWeight: 800 }}>{ev.place.name}</div>
                      {ev.flight ? (
                        <div className="muted">
                          {fmtDateTime(ev.flight.departAt)} → {fmtDateTime(ev.flight.arriveAt)}
                          {ev.flight.durationMinutes != null && ` · ${formatDuration(ev.flight.durationMinutes)}`}
                          {ev.flight.bookingRef ? ` · 예약번호 ${ev.flight.bookingRef}` : ' · 예약번호 미입력'}
                        </div>
                      ) : <div className="muted">아직 항공 상세정보가 없어요 — 동선에서 입력해주세요.</div>}
                    </div>
                    <span className={`chip ${prebookedForEvent(ev.id) ? 'green' : 'yellow'}`}>
                      {prebookedForEvent(ev.id) ? '💳 결제 기록됨' : '결제 미기록'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {stays.length > 0 && (
              <div className="section-gap">
                <strong>🏨 숙소</strong>
                {stays.map((ev) => (
                  <div key={ev.id} className="row">
                    <span className="chip blue">{ev.dayNumber}일차</span>
                    <div className="grow">
                      <div style={{ fontWeight: 800 }}>{ev.place.name}</div>
                      {ev.place.address && <div className="muted">📍 {ev.place.address}</div>}
                    </div>
                    <span className={`chip ${prebookedForEvent(ev.id) ? 'green' : 'yellow'}`}>
                      {prebookedForEvent(ev.id) ? '💳 결제 기록됨' : '결제 미기록'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Window>

      <Window title="PREP_LIST.EXE" color="green">
        <div className="grid">
          <ChecklistPanel tripId={trip.id} scope="predeparture" title="🛫 여행 전 Todo" addPlaceholder="예: 여행자보험 가입" />
          <ChecklistPanel tripId={trip.id} scope="packing" title="🎒 여행 준비물" addPlaceholder="예: 여권, 충전기" />
        </div>
      </Window>
    </div>
  )
}
