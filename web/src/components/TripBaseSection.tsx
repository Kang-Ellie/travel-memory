import { useEffect, useState } from 'react'
import type { Trip, Country, City, BucketItem, Place, BucketKind } from '../../shared/types'
import { BUCKET_KIND_LABEL, bucketKindOf } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import Window from './Window'
import Select from './Select'
import ChecklistPanel from './ChecklistPanel'

const KIND_PLACEHOLDER: Record<BucketKind, string> = {
  bucket: '해보고 싶은 것', food: '먹어보고 싶은 것 (예: 멘타이코 정식)', wish: '사고 싶은 것 (예: 캐리어)',
}

function BaseListRow({
  item, kind, places, tripId, onChanged,
}: { item: BucketItem; kind: BucketKind; places: Place[]; tripId: string; onChanged: () => void }) {
  const [linkingPlace, setLinkingPlace] = useState(false)
  const [placeId, setPlaceId] = useState('')
  const linkedPlace = item.linkedPlaceId ? places.find((p) => p.id === item.linkedPlaceId) : undefined
  const inTrip = item.linkedTripId === tripId

  const toggleDone = async () => {
    await api.bucket.update(item.id, { done: !item.done })
    onChanged()
  }
  const addToTrip = async () => {
    await api.bucket.update(item.id, { linkedTripId: tripId })
    onChanged()
  }
  const linkPlace = async () => {
    if (!placeId) return
    await api.bucket.update(item.id, { linkedPlaceId: placeId })
    setLinkingPlace(false)
    onChanged()
  }
  const unlinkPlace = async () => {
    await api.bucket.update(item.id, { linkedPlaceId: null })
    onChanged()
  }

  const placeLine = () => {
    if (!linkedPlace) return null
    if (kind === 'food') {
      return (
        <>📍 {linkedPlace.name}{linkedPlace.recommendedMenu ? ` · 여기서 ${linkedPlace.recommendedMenu} 잘해요` : ''}</>
      )
    }
    if (kind === 'wish') return <>🛍 여기서 살 수 있어요: {linkedPlace.name}</>
    return <>📍 {linkedPlace.name}</>
  }

  return (
    <div className="row" style={{ flexWrap: 'wrap' }}>
      <input type="checkbox" checked={item.done} onChange={toggleDone} title="완료로 표시" />
      <div className="grow">
        <div style={{ fontWeight: 800, textDecoration: item.done ? 'line-through' : undefined }}>{item.title}</div>
        {item.memo && <div style={{ color: 'var(--ink)', opacity: 0.75, fontSize: 13, whiteSpace: 'pre-wrap' }}>{item.memo}</div>}
        {linkedPlace && (
          <div style={{ color: 'var(--ink)', opacity: 0.8, fontSize: 13, marginTop: 2 }}>{placeLine()}</div>
        )}
        {linkingPlace && (
          <div className="row" style={{ marginTop: 6, border: 'none', padding: 0 }}>
            <Select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
              <option value="">— 장소 선택 —</option>
              {places.map((p) => <option key={p.id} value={p.id}>[{p.category}] {p.name}</option>)}
            </Select>
            <button className="btn small primary" onClick={linkPlace}>연결</button>
            <button className="btn small" onClick={() => setLinkingPlace(false)}>취소</button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {linkedPlace ? (
          <button className="btn small ghost" onClick={unlinkPlace}>연결 해제</button>
        ) : !linkingPlace && (
          <button className="btn small ghost" onClick={() => setLinkingPlace(true)}>📍 장소 족보와 연결</button>
        )}
        {!inTrip && <button className="btn small" onClick={addToTrip}>＋ 이 여행에 담기</button>}
      </div>
    </div>
  )
}

export default function TripBaseSection({ trip }: { trip: Trip }) {
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [bucket, setBucket] = useState<BucketItem[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [collapsed, setCollapsed] = useState(false)

  const refresh = () => {
    api.countries.list().then(setCountries)
    api.cities.list().then(setCities)
    api.bucket.list().then(setBucket)
    api.places.list().then(setPlaces)
  }
  useEffect(refresh, [trip.id])

  if (trip.cities.length === 0) {
    return (
      <Window title="BASE.EXE" color="blue">
        <span style={{ color: 'var(--ink)', opacity: 0.7 }}>
          🌍 국가·도시가 아직 연결 안 됐어요 — 상단 "✏️ 여행 정보 수정"에서 어디로 가는지 먼저 등록해주세요.
        </span>
      </Window>
    )
  }

  const tripCityRecords = trip.cities
    .map((tc) => cities.find((c) => c.id === tc.id))
    .filter((c): c is City => !!c)
  const countryIds = new Set(tripCityRecords.map((c) => c.countryId))
  const tripCountries = countries.filter((c) => countryIds.has(c.id))
  const itemsForBase = bucket.filter((b) => b.countryIds.some((id) => countryIds.has(id)) || b.linkedTripId === trip.id)
  const byKind = (kind: BucketKind) => itemsForBase.filter((b) => bucketKindOf(b.category) === kind)

  return (
    <Window title="BASE.EXE" color="blue">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: collapsed ? 0 : 10 }}>
        <strong className="grow">🧭 이번엔 어디?</strong>
        <button className="btn small ghost" onClick={() => setCollapsed((v) => !v)}>{collapsed ? '펼치기' : '접기'}</button>
      </div>
      {!collapsed && (
        <>
          {tripCountries.map((co) => {
            const citiesOfCountry = tripCityRecords.filter((c) => c.countryId === co.id)
            return (
              <div key={co.id} className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>{flagEmoji(co.code)} {co.name}</div>
                <div className="base-split">
                  <div className="info-text" style={{ color: 'var(--ink)', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontWeight: 800, opacity: 0.55, fontSize: 11, letterSpacing: '0.04em' }}>🌍 국가 정보</div>
                    {co.capital && <span>🏛 수도 {co.capital}</span>}
                    {co.currency && <span>💱 통화 {co.currency}</span>}
                    {co.voltage && <span>🔌 전압 {co.voltage}</span>}
                    {co.language && <span>🗣 언어 {co.language}</span>}
                    {co.visa && <span>🛂 비자 {co.visa}</span>}
                    {co.emergencyPolice && <span>🚓 경찰 {co.emergencyPolice}</span>}
                    {co.emergencyMedical && <span>🚑 응급 {co.emergencyMedical}</span>}
                    {co.prepDocs && <span style={{ whiteSpace: 'pre-wrap' }}>📋 준비서류: {co.prepDocs}</span>}
                  </div>
                  <div className="info-text" style={{ color: 'var(--ink)', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontWeight: 800, opacity: 0.55, fontSize: 11, letterSpacing: '0.04em' }}>🏙 도시 정보</div>
                    {citiesOfCountry.length === 0 ? (
                      <span style={{ opacity: 0.6 }}>등록된 도시 정보가 없어요.</span>
                    ) : citiesOfCountry.map((c) => (
                      <div key={c.id}>
                        <div style={{ fontWeight: 700 }}>{c.name}</div>
                        {c.flightDuration && <div>✈️ {c.flightDuration}</div>}
                        {c.timeDiff && <div>🕐 시차 {c.timeDiff}</div>}
                        {!c.flightDuration && !c.timeDiff && <div style={{ opacity: 0.6 }}>항공 소요시간·시차 미입력</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1.5px solid rgba(45,42,62,0.15)' }}>
            <div className="prep-split">
              <ChecklistPanel tripId={trip.id} scope="predeparture" title="🛫 여행 전 Todo" addPlaceholder="예: 여행자보험 가입" />
              <ChecklistPanel tripId={trip.id} scope="packing" title="🎒 여행 준비물" addPlaceholder="예: 여권, 충전기" />
            </div>
          </div>

          {(['bucket', 'food', 'wish'] as BucketKind[]).map((kind) => {
            const items = byKind(kind)
            return (
              <div key={kind} style={{ marginTop: 14, paddingTop: 14, borderTop: '1.5px solid rgba(45,42,62,0.15)' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{BUCKET_KIND_LABEL[kind]}</div>
                {items.length === 0 ? (
                  <div className="empty">{KIND_PLACEHOLDER[kind]} — 아직 등록된 항목이 없어요. 버킷리스트 탭에서 추가해보세요.</div>
                ) : items.map((b) => (
                  <BaseListRow key={b.id} item={b} kind={kind} places={places} tripId={trip.id} onChanged={refresh} />
                ))}
              </div>
            )
          })}
        </>
      )}
    </Window>
  )
}
