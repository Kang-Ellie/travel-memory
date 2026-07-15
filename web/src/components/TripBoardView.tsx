import { useState } from 'react'
import type { Trip, TimelineEvent } from '../../shared/types'
import { api } from '../api'
import { dayCount, dayLabel } from './TripWorkspace'

// 일정을 날짜별 세로 리스트 대신 칸반 보드로 — 데스크톱에서 날짜 간 드래그 이동에 특화된
// 보조 뷰. 카드를 클릭하면 그 날짜의 리스트 뷰(사진·리뷰 등 전체 편집)로 넘어간다.
export default function TripBoardView({
  trip, events, onChanged, onOpenDay,
}: {
  trip: Trip
  events: TimelineEvent[]
  onChanged: () => void
  onOpenDay: (day: number) => void
}) {
  const days = Array.from({ length: dayCount(trip) }, (_, i) => i + 1)
  const [dragEventId, setDragEventId] = useState<string | null>(null)
  const [dragOverDay, setDragOverDay] = useState<number | null>(null)

  const eventsOf = (d: number) =>
    events.filter((e) => e.dayNumber === d).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))

  const moveTo = async (eventId: string, day: number) => {
    const ev = events.find((e) => e.id === eventId)
    if (!ev || ev.dayNumber === day) return
    await api.events.assignDay(trip.id, eventId, day)
    onChanged()
  }

  return (
    <div className="board-view">
      {days.map((d) => (
        <div
          key={d}
          className={`board-col ${dragOverDay === d ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOverDay(d) }}
          onDragLeave={() => setDragOverDay((v) => (v === d ? null : v))}
          onDrop={(e) => {
            e.preventDefault()
            setDragOverDay(null)
            if (dragEventId) moveTo(dragEventId, d)
          }}
        >
          <button type="button" className="board-col-head" onClick={() => onOpenDay(d)}>
            <strong>{d}일차</strong>
            <span className="muted">{dayLabel(trip, d)}</span>
          </button>
          <div className="board-col-body">
            {eventsOf(d).length === 0 ? (
              <div className="muted board-col-empty">일정 없음</div>
            ) : (
              eventsOf(d).map((ev) => (
                <div
                  key={ev.id}
                  className="board-card"
                  draggable
                  onDragStart={() => setDragEventId(ev.id)}
                  onDragEnd={() => setDragEventId(null)}
                  onClick={() => onOpenDay(d)}
                >
                  {ev.plannedTime && <div className="board-card-time">🕒 {ev.plannedTime}</div>}
                  <div className="board-card-name">{ev.place.name}</div>
                  <span className="chip blue" style={{ fontSize: 10, alignSelf: 'flex-start' }}>{ev.place.category}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
