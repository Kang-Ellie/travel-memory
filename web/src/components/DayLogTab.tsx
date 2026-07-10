import { useEffect, useState } from 'react'
import type { Trip, TimelineEvent, DayNote } from '../../shared/types'
import { api } from '../api'
import Window from './Window'
import ChecklistPanel from './ChecklistPanel'
import DayNoteBox from './DayNoteBox'
import { dayCount, dayLabel } from './TripWorkspace'

export default function DayLogTab({ trip }: { trip: Trip }) {
  const days = dayCount(trip)
  const [day, setDay] = useState(1)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [dayNotes, setDayNotes] = useState<DayNote[]>([])

  const refresh = () => {
    api.events.list(trip.id).then(setEvents)
    api.dayNotes.list(trip.id).then(setDayNotes)
  }
  useEffect(refresh, [trip.id])

  const dayCityLabel = (d: number): string | null => {
    const explicit = dayNotes.find((n) => n.dayNumber === d)?.cityName
    if (explicit) return explicit
    const evs = events.filter((e) => e.dayNumber === d).sort((a, b) => a.sequence - b.sequence)
    const cities = evs.map((e) => e.place.cityName).filter((c): c is string => !!c)
    if (cities.length === 0) return null
    const first = cities[0]
    const last = cities[cities.length - 1]
    return first === last ? first : `${first} - ${last}`
  }

  return (
    <div className="workspace">
      <div className="day-nav-col">
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
          const cityLabel = dayCityLabel(d)
          return (
            <button key={d} className={`day-nav-btn ${day === d ? 'active' : ''}`} onClick={() => setDay(d)}>
              <div>{d}일차 <span style={{ fontWeight: 400, fontSize: 11 }}>{dayLabel(trip, d)}</span></div>
              {cityLabel && <div style={{ fontWeight: 400, fontSize: 11 }}>🌆 {cityLabel}</div>}
            </button>
          )
        })}
      </div>
      <div>
        <Window title="TODO_DIARY.EXE" color="yellow">
          <ChecklistPanel tripId={trip.id} scope="day" dayNumber={day} title="✅ 오늘 해야할 일" addPlaceholder="예: 호텔 체크인, 유심 개통" />
          <div style={{ marginTop: 14 }}>
            <DayNoteBox tripId={trip.id} dayNumber={day} cities={trip.cities} onChanged={refresh} />
          </div>
        </Window>
      </div>
    </div>
  )
}
