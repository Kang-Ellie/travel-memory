import { useEffect, useRef, useState } from 'react'
import type { Trip, Place, TimelineEvent } from '../../shared/types'
import { api } from '../api'

// 발렛·항공·숙소는 예매해둔 "티켓"이지 둘러볼 "장소"가 아니라서 지도에서 아예 뺀다.
const TICKET_CATEGORIES = new Set(['발렛', '공항', '숙소'])

let mapsPromise: Promise<void> | null = null

function loadGoogleMaps(key: string): Promise<void> {
  if ((window as any).google?.maps) return Promise.resolve()
  if (mapsPromise) return mapsPromise
  mapsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&language=ko`
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      mapsPromise = null
      reject(new Error('구글 지도를 불러오지 못했어요. 인터넷 연결과 API 키를 확인해주세요.'))
    }
    document.head.appendChild(s)
  })
  return mapsPromise
}

export default function MapTab({ trip, day }: { trip: Trip; day?: number }) {
  const holder = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'nokey' | 'nopins' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [noCoordPlaces, setNoCoordPlaces] = useState<Place[]>([])
  // 일차가 넘어오면 기본은 "이 날만" — 오늘 동선이 지그재그인지 한눈에 보려는 용도.
  const [filterMode, setFilterMode] = useState<'day' | 'all'>(day != null ? 'day' : 'all')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const key = await api.settings.get('googleApiKey')
      if (cancelled) return
      if (!key) { setStatus('nokey'); return }

      const events = await api.events.list(trip.id)
      const relevant = events
        .filter((ev) => !TICKET_CATEGORIES.has(ev.place.category))
        .filter((ev) => filterMode === 'all' || ev.dayNumber === day)
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))

      const noCoord: Place[] = []
      let pinEvents: TimelineEvent[]
      if (filterMode === 'day') {
        // 하루 동선은 순서가 중요하므로 중복 방문도 그대로 두고 시퀀스 순으로 핀·경로선을 그린다.
        pinEvents = relevant.filter((ev) => {
          const has = ev.place.lat != null && ev.place.lng != null
          if (!has) noCoord.push(ev.place)
          return has
        })
      } else {
        // 전체 보기는 같은 장소가 여러 번 나오면 핀이 겹치니 장소 단위로 중복 제거.
        const seen = new Set<string>()
        pinEvents = []
        for (const ev of relevant) {
          if (seen.has(ev.place.id)) continue
          seen.add(ev.place.id)
          if (ev.place.lat != null && ev.place.lng != null) pinEvents.push(ev)
          else noCoord.push(ev.place)
        }
      }

      setNoCoordPlaces(noCoord)
      if (pinEvents.length === 0) { setStatus('nopins'); return }

      try {
        await loadGoogleMaps(key)
      } catch (err) {
        if (!cancelled) { setStatus('error'); setErrorMsg(String(err)) }
        return
      }
      if (cancelled || !holder.current) return

      const g = (window as any).google
      const map = new g.maps.Map(holder.current, {
        center: { lat: pinEvents[0].place.lat, lng: pinEvents[0].place.lng },
        zoom: 13,
      })
      const bounds = new g.maps.LatLngBounds()
      const path: Array<{ lat: number; lng: number }> = []
      pinEvents.forEach((ev, i) => {
        const p = ev.place
        const pos = { lat: p.lat as number, lng: p.lng as number }
        const marker = new g.maps.Marker({
          position: pos, map, title: p.name,
          label: filterMode === 'day' ? { text: String(i + 1), color: '#fff' } : undefined,
        })
        const info = new g.maps.InfoWindow({
          content: `<div style="font-weight:700">${p.name}</div><div style="font-size:12px">${p.address}</div>`,
        })
        marker.addListener('click', () => info.open({ map, anchor: marker }))
        bounds.extend(pos)
        path.push(pos)
      })
      if (filterMode === 'day' && path.length > 1) {
        new g.maps.Polyline({
          path, map, strokeColor: '#ff5fa2', strokeOpacity: 0.9, strokeWeight: 4,
        })
      }
      if (pinEvents.length > 1) map.fitBounds(bounds, 60)
      setStatus('ready')
    })()
    return () => { cancelled = true }
  }, [trip.id, day, filterMode])

  return (
    <div>
      {day != null && (
        <div className="day-tabs" style={{ marginBottom: 10 }}>
          <button className={`pill ${filterMode === 'day' ? 'active' : ''}`} onClick={() => setFilterMode('day')}>
            📍 이 날만
          </button>
          <button className={`pill ${filterMode === 'all' ? 'active' : ''}`} onClick={() => setFilterMode('all')}>
            🗺 전체 보기
          </button>
        </div>
      )}
      {status === 'nokey' && (
        <div className="empty">
          🔑 [⚙️ 설정]에서 구글 API 키를 등록하면 이 여행의 장소들이 지도에 표시돼요.<br />
          키가 없어도 동선·리뷰·정산 기능은 전부 사용할 수 있어요.
        </div>
      )}
      {status === 'nopins' && (
        <div className="empty">
          {filterMode === 'day'
            ? '이 날은 좌표가 있는 장소가 아직 없어요.'
            : <>좌표가 있는 장소가 아직 없어요.<br />[📍 장소 족보]에서 구글 검색으로 저장한 장소를 동선에 추가하면 지도에 나타나요.</>}
        </div>
      )}
      {status === 'error' && <div className="error-text">{errorMsg}</div>}
      <div className="map-holder" ref={holder}
        style={{ display: status === 'ready' || status === 'loading' ? 'block' : 'none' }} />
      {noCoordPlaces.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="muted" style={{ marginBottom: 6 }}>🧭 좌표가 없어 지도에 못 그린 장소</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {noCoordPlaces.map((p, i) => <span key={`${p.id}-${i}`} className="chip yellow">{p.name}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}
