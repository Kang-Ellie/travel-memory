import { useEffect, useRef, useState } from 'react'
import type { Trip, Place } from '../../shared/types'
import { api } from '../api'

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

export default function MapTab({ trip }: { trip: Trip }) {
  const holder = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'nokey' | 'nopins' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [noCoordPlaces, setNoCoordPlaces] = useState<Place[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const key = await api.settings.get('googleApiKey')
      if (cancelled) return
      if (!key) { setStatus('nokey'); return }

      const events = await api.events.list(trip.id)
      const seen = new Set<string>()
      const pins: Place[] = []
      const noCoord: Place[] = []
      for (const ev of events) {
        if (seen.has(ev.place.id)) continue
        seen.add(ev.place.id)
        if (ev.place.lat != null && ev.place.lng != null) pins.push(ev.place)
        else noCoord.push(ev.place)
      }
      setNoCoordPlaces(noCoord)
      if (pins.length === 0) { setStatus('nopins'); return }

      try {
        await loadGoogleMaps(key)
      } catch (err) {
        if (!cancelled) { setStatus('error'); setErrorMsg(String(err)) }
        return
      }
      if (cancelled || !holder.current) return

      const g = (window as any).google
      const map = new g.maps.Map(holder.current, {
        center: { lat: pins[0].lat, lng: pins[0].lng },
        zoom: 13,
      })
      const bounds = new g.maps.LatLngBounds()
      for (const p of pins) {
        const pos = { lat: p.lat as number, lng: p.lng as number }
        const marker = new g.maps.Marker({ position: pos, map, title: p.name })
        const info = new g.maps.InfoWindow({
          content: `<div style="font-weight:700">${p.name}</div><div style="font-size:12px">${p.address}</div>`,
        })
        marker.addListener('click', () => info.open({ map, anchor: marker }))
        bounds.extend(pos)
      }
      if (pins.length > 1) map.fitBounds(bounds, 60)
      setStatus('ready')
    })()
    return () => { cancelled = true }
  }, [trip.id])

  return (
    <div>
      {status === 'nokey' && (
        <div className="empty">
          🔑 [⚙️ 설정]에서 구글 API 키를 등록하면 이 여행의 장소들이 지도에 표시돼요.<br />
          키가 없어도 동선·리뷰·정산 기능은 전부 사용할 수 있어요.
        </div>
      )}
      {status === 'nopins' && (
        <div className="empty">
          좌표가 있는 장소가 아직 없어요.<br />
          [📍 장소 족보]에서 구글 검색으로 저장한 장소를 동선에 추가하면 지도에 나타나요.
        </div>
      )}
      {status === 'error' && <div className="error-text">{errorMsg}</div>}
      <div className="map-holder" ref={holder}
        style={{ display: status === 'ready' || status === 'loading' ? 'block' : 'none' }} />
      {noCoordPlaces.length > 0 && (
        <div className="muted" style={{ marginTop: 10 }}>
          🧭 좌표가 없어 지도에 못 그린 장소: {noCoordPlaces.map((p) => p.name).join(', ')}
        </div>
      )}
    </div>
  )
}
