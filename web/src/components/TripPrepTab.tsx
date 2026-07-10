import { useEffect, useState } from 'react'
import type { Trip, TimelineEvent, Expense, BucketItem } from '../../shared/types'
import { api } from '../api'
import Window from './Window'
import ChecklistPanel from './ChecklistPanel'

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
  const [bucket, setBucket] = useState<BucketItem[]>([])

  const refresh = () => {
    api.events.list(trip.id).then(setEvents)
    api.expenses.list(trip.id).then(setExpenses)
    api.bucket.list().then(setBucket)
  }
  useEffect(refresh, [trip.id])

  const byDay = (a: TimelineEvent, b: TimelineEvent) => a.dayNumber - b.dayNumber || a.sequence - b.sequence
  const flights = events.filter((e) => e.place.category === '공항').sort(byDay)
  const stays = events.filter((e) => e.place.category === '숙소').sort(byDay)
  const prebookedForEvent = (eventId: string) => expenses.some((e) => e.eventId === eventId && e.isPrebooked)
  const linkedBucket = bucket.filter((b) => b.linkedTripId === trip.id)

  return (
    <div>
      <Window title="PREBOOKED.EXE" color="blue">
        <p className="muted" style={{ marginTop: 0 }}>
          항공·숙소처럼 미리 예약/결제하는 것들을 한 눈에 모아뒀어요. (지출 기록에서 "사전예약"으로 표시한 항목이 있으면 "결제 기록됨"으로 표시돼요)
        </p>
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

      {linkedBucket.length > 0 && (
        <Window title="BUCKET_LINKED.EXE" color="pink">
          {linkedBucket.map((b) => (
            <div key={b.id} className="row">
              <input type="checkbox" checked={b.done}
                onChange={() => api.bucket.update(b.id, { done: !b.done }).then(refresh)} />
              <div className="grow">
                <div style={{ fontWeight: 800, textDecoration: b.done ? 'line-through' : undefined }}>{b.title}</div>
                {(b.countryName || b.memo) && (
                  <div className="muted">{b.countryName && `🌍 ${b.countryName}${b.cityName ? ` · ${b.cityName}` : ''} `}{b.memo}</div>
                )}
              </div>
            </div>
          ))}
        </Window>
      )}

      <Window title="PACKING.EXE" color="yellow">
        <ChecklistPanel tripId={trip.id} scope="packing" title="🎒 여행 준비물" addPlaceholder="예: 여권, 충전기" />
      </Window>
    </div>
  )
}
