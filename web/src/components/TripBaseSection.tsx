import { useEffect, useState } from 'react'
import type { Trip, Country, City, BucketItem } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import Window from './Window'

export default function TripBaseSection({ trip }: { trip: Trip }) {
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [bucket, setBucket] = useState<BucketItem[]>([])
  const [collapsed, setCollapsed] = useState(false)

  const refresh = () => {
    api.countries.list().then(setCountries)
    api.cities.list().then(setCities)
    api.bucket.list().then(setBucket)
  }
  useEffect(refresh, [trip.id])

  if (trip.cities.length === 0) return null

  const tripCityRecords = trip.cities
    .map((tc) => cities.find((c) => c.id === tc.id))
    .filter((c): c is City => !!c)
  const countryIds = new Set(tripCityRecords.map((c) => c.countryId))
  const tripCountries = countries.filter((c) => countryIds.has(c.id))
  const suggestions = bucket.filter((b) => b.countryId && countryIds.has(b.countryId) && b.linkedTripId !== trip.id)

  const linkToTrip = async (itemId: string) => {
    await api.bucket.update(itemId, { linkedTripId: trip.id, done: true })
    refresh()
  }

  return (
    <Window title="BASE.EXE" color="blue">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: collapsed ? 0 : 10 }}>
        <strong className="grow">🌍 이번 여행 나라 정보</strong>
        <button className="btn small ghost" onClick={() => setCollapsed((v) => !v)}>{collapsed ? '펼치기' : '접기'}</button>
      </div>
      {!collapsed && (
        <>
          {tripCountries.map((co) => {
            const citiesOfCountry = tripCityRecords.filter((c) => c.countryId === co.id)
            return (
              <div key={co.id} className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{flagEmoji(co.code)} {co.name}</div>
                <div className="muted" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '2px 12px' }}>
                  {co.capital && <span>🏛 수도 {co.capital}</span>}
                  {co.currency && <span>💱 통화 {co.currency}</span>}
                  {co.voltage && <span>🔌 전압 {co.voltage}</span>}
                  {co.language && <span>🗣 언어 {co.language}</span>}
                  {co.visa && <span>🛂 비자 {co.visa}</span>}
                  {co.emergencyPolice && <span>🚓 경찰 {co.emergencyPolice}</span>}
                  {co.emergencyMedical && <span>🚑 응급 {co.emergencyMedical}</span>}
                </div>
                {co.prepDocs && <div className="muted" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>📋 준비서류: {co.prepDocs}</div>}
                {citiesOfCountry.map((c) => (c.flightDuration || c.timeDiff) && (
                  <div key={c.id} className="muted" style={{ marginTop: 4 }}>
                    🏙 {c.name}{c.flightDuration && ` · ✈️ ${c.flightDuration}`}{c.timeDiff && ` · 🕐 시차 ${c.timeDiff}`}
                  </div>
                ))}
              </div>
            )
          })}
          {suggestions.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1.5px solid rgba(45,42,62,0.15)' }}>
              <div className="muted" style={{ fontWeight: 700, marginBottom: 6 }}>✨ 이 나라 버킷리스트에서 골라보세요</div>
              {suggestions.map((b) => (
                <div key={b.id} className="row">
                  <div className="grow">
                    <div style={{ fontWeight: 700 }}>{b.title}</div>
                    {b.memo && <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{b.memo}</div>}
                  </div>
                  <button className="btn small" onClick={() => linkToTrip(b.id)}>여행에 연결</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Window>
  )
}
