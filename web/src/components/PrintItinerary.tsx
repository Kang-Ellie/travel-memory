import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Trip, TimelineEvent } from '../../shared/types'
import { api } from '../api'
import { fmtRange } from './TripsScreen'
import { dayCount, dayLabel } from './TripWorkspace'

// 로밍이 안 되는 여행 중에도 볼 수 있게, 일정만 깔끔하게 뽑아 인쇄(또는 브라우저의
// "PDF로 저장")할 수 있는 뷰. body 전체를 숨기고 이 컴포넌트만 보이게 하는
// visibility 트릭이라 어디서 렌더링되든(포털) 인쇄 결과에 영향받지 않는다.
export default function PrintItinerary({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])

  useEffect(() => {
    api.events.list(trip.id).then(setEvents)
  }, [trip.id])

  const days = Array.from({ length: dayCount(trip) }, (_, i) => i + 1)
  const eventsOf = (day: number) =>
    events
      .filter((e) => e.dayNumber === day)
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
  const unassigned = events.filter((e) => e.dayNumber == null)

  return createPortal(
    <div className="print-itinerary">
      <div className="print-itinerary-actions">
        <button type="button" className="btn primary" onClick={() => window.print()}>🖨 인쇄 / PDF로 저장</button>
        <button type="button" className="btn" onClick={onClose} style={{ marginLeft: 8 }}>닫기</button>
      </div>

      <h1 style={{ marginBottom: 2 }}>{trip.title}</h1>
      <div className="muted" style={{ marginBottom: 24 }}>{fmtRange(trip)}</div>

      {days.map((day) => {
        const dayEvents = eventsOf(day)
        return (
          <div key={day} className="print-day">
            <h2>{day}일차 · {dayLabel(trip, day)}</h2>
            {dayEvents.length === 0 ? (
              <div className="muted">일정 없음</div>
            ) : (
              <table className="print-day-table">
                <tbody>
                  {dayEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td className="print-time">{ev.plannedTime || '—'}</td>
                      <td>
                        <div className="print-place-name">[{ev.place.category}] {ev.place.name}</div>
                        {ev.place.address && <div className="muted">{ev.place.address}</div>}
                        {ev.memo && <div className="muted">📝 {ev.memo}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}

      {unassigned.length > 0 && (
        <div className="print-day">
          <h2>📌 일차 미배정</h2>
          <table className="print-day-table">
            <tbody>
              {unassigned.map((ev) => (
                <tr key={ev.id}>
                  <td className="print-time">—</td>
                  <td>
                    <div className="print-place-name">[{ev.place.category}] {ev.place.name}</div>
                    {ev.place.address && <div className="muted">{ev.place.address}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>,
    document.body,
  )
}
