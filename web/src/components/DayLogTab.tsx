import { useEffect, useState } from 'react'
import type { Trip, TimelineEvent, DayNote, TripCity } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
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

  const dayCityInfo = (d: number): { label: string; flags: string } | null => {
    const explicitIds = dayNotes.find((n) => n.dayNumber === d)?.cityIds ?? []
    const explicitCities = explicitIds
      .map((id) => trip.cities.find((c) => c.id === id))
      .filter((c): c is TripCity => !!c)
    if (explicitCities.length > 0) {
      return {
        label: explicitCities.map((c) => c.name).join(', '),
        flags: [...new Set(explicitCities.map((c) => flagEmoji(c.countryCode)))].join(''),
      }
    }
    const evs = events.filter((e) => e.dayNumber === d).sort((a, b) => a.sequence - b.sequence)
    const cities = evs.map((e) => e.place.cityName).filter((c): c is string => !!c)
    if (cities.length === 0) return null
    const first = cities[0]
    const last = cities[cities.length - 1]
    const codes = [...new Set(evs.map((e) => e.place.countryCode).filter((c): c is string => !!c))]
    return {
      label: first === last ? first : `${first} - ${last}`,
      flags: codes.map((c) => flagEmoji(c)).join('') || '🌆',
    }
  }

  return (
    <div className="workspace">
      <div className="day-nav-col">
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
          const cityInfo = dayCityInfo(d)
          return (
            <button key={d} className={`day-nav-btn ${day === d ? 'active' : ''}`} onClick={() => setDay(d)}>
              <div>{d}일차 <span style={{ fontWeight: 400, fontSize: 11 }}>{dayLabel(trip, d)}</span></div>
              {cityInfo && <div style={{ fontWeight: 400, fontSize: 11 }}>{cityInfo.flags} {cityInfo.label}</div>}
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
