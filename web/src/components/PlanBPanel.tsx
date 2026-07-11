import { useState } from 'react'
import type { Trip, Place, TimelineEvent } from '../../shared/types'
import { api } from '../api'
import { ratingColor } from '../categories'

const CATEGORY_ORDER = ['맛집', '카페', '명소', '쇼핑', '숙소', '공항', '기타']

export default function PlanBPanel({
  trip, places, events, day, onAdded,
}: { trip: Trip; places: Place[]; events: TimelineEvent[]; day: number; onAdded: () => void }) {
  const [adding, setAdding] = useState<string | null>(null)

  const countryCodes = new Set(trip.cities.map((c) => c.countryCode).filter((c): c is string => !!c))
  const usedPlaceIds = new Set(events.map((e) => e.placeId))
  const candidates = places.filter((p) => p.countryCode && countryCodes.has(p.countryCode) && !usedPlaceIds.has(p.id))

  const addToDay = async (placeId: string) => {
    setAdding(placeId)
    await api.events.create({ tripId: trip.id, placeId, dayNumber: day })
    setAdding(null)
    onAdded()
  }

  if (trip.cities.length === 0) {
    return <div className="empty">여행에 국가·도시를 먼저 연결하면, 그 지역 장소 족보에서 후보를 골라볼 수 있어요.</div>
  }
  if (candidates.length === 0) {
    return <div className="empty">이 여행 지역에 등록된 장소 중 아직 동선에 없는 곳이 없어요. 장소 족보에서 더 등록해보세요!</div>
  }

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        이 지역 장소 족보 중 아직 동선(PLAN A)에 없는 곳들이에요. 마음에 드는 곳은 아무 때나 눌러서 {day}일차에 바로 넣어보세요.
      </p>
      {CATEGORY_ORDER.map((cat) => {
        const items = candidates.filter((p) => p.category === cat)
        if (items.length === 0) return null
        return (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>{cat}</div>
            {items.map((p) => (
              <div key={p.id} className="row" style={{ flexWrap: 'wrap' }}>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>
                    {p.name}
                    {p.rating != null && (
                      <span style={{ marginLeft: 6, color: ratingColor(p.rating), fontWeight: 800 }}>★ {p.rating.toFixed(1)}</span>
                    )}
                  </div>
                  {p.address && <div className="muted">📍 {p.address}</div>}
                </div>
                <button className="btn small primary" disabled={adding === p.id} onClick={() => addToDay(p.id)}>
                  {adding === p.id ? '추가 중…' : `＋ ${day}일차에 추가`}
                </button>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
