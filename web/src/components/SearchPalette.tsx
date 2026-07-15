import { useEffect, useRef, useState } from 'react'
import type { Trip, Country, City, Place, BucketItem, Member } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import type { BookmarkSection } from './BookmarksScreen'

type ResultKind = 'trip' | 'country' | 'city' | 'place' | 'bucket' | 'member'
interface SearchResult { kind: ResultKind; id: string; title: string; sub: string; icon: string }

export type QuickAddTarget = 'trip' | 'bucket' | 'place' | 'country' | 'member'
const QUICK_ADD_OPTIONS: Array<{ target: QuickAddTarget; icon: string; label: string; hint: string }> = [
  { target: 'trip', icon: '🏝', label: '여행', hint: '새 여행 만들기' },
  { target: 'bucket', icon: '✨', label: '버킷 · 먹킷 · 위시리스트', hint: '하고 싶은 것 · 먹고 싶은 것 · 사고 싶은 것' },
  { target: 'place', icon: '📍', label: '장소', hint: '장소 북마크에 바로 등록' },
  { target: 'country', icon: '🌍', label: '국가', hint: '국가 도감에 새 나라 등록' },
  { target: 'member', icon: '🧑‍🤝‍🧑', label: '동행인', hint: '같이 가는 사람 등록' },
]

// 국가·도시·장소·버킷리스트·여행·동행인을 한 번에 찾는 검색 팔레트 + 어디서든 바로 등록화면으로
// 점프하는 "빠른 등록" 모드. 화면마다 흩어진 등록 화면을 일일이 찾아 들어가지 않아도 되게 하는 게
// 목적이라, 열릴 때 한 번에 목록을 다 불러와두고 타이핑마다는 클라이언트에서만 필터링한다.
export default function SearchPalette({
  onClose, onOpenTrip, onNavigate, onQuickAdd,
}: {
  onClose: () => void
  onOpenTrip: (t: Trip) => void
  onNavigate: (screen: 'trips' | 'bookmarks' | 'countries' | 'members', bookmarkSection?: BookmarkSection) => void
  onQuickAdd: (target: QuickAddTarget) => void
}) {
  const [mode, setMode] = useState<'search' | 'add'>('search')
  const [query, setQuery] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [trips, setTrips] = useState<Trip[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [bucket, setBucket] = useState<BucketItem[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      api.trips.list(), api.countries.list(), api.cities.list(),
      api.places.list(), api.bucket.list(), api.members.list(),
    ]).then(([t, c, ci, p, b, m]) => {
      setTrips(t); setCountries(c); setCities(ci); setPlaces(p); setBucket(b); setMembers(m)
      setLoaded(true)
    })
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const q = query.trim().toLowerCase()
  const countryName = new Map(countries.map((c) => [c.id, c.name]))

  const results: SearchResult[] = q.length === 0 ? [] : [
    ...trips.filter((t) => t.title.toLowerCase().includes(q))
      .map((t): SearchResult => ({ kind: 'trip', id: t.id, title: t.title, sub: '여행', icon: '🏝' })),
    ...countries.filter((c) => c.name.toLowerCase().includes(q))
      .map((c): SearchResult => ({ kind: 'country', id: c.id, title: `${flagEmoji(c.code)} ${c.name}`, sub: '국가 도감', icon: '🌍' })),
    ...cities.filter((c) => c.name.toLowerCase().includes(q))
      .map((c): SearchResult => ({
        kind: 'city', id: c.id, title: c.name,
        sub: `국가 도감 · ${countryName.get(c.countryId) ?? ''}`, icon: '🏙',
      })),
    ...places.filter((p) => p.name.toLowerCase().includes(q) || (p.address ?? '').toLowerCase().includes(q))
      .map((p): SearchResult => ({ kind: 'place', id: p.id, title: p.name, sub: `장소 북마크 · ${p.category}`, icon: '📍' })),
    ...bucket.filter((b) => b.title.toLowerCase().includes(q))
      .map((b): SearchResult => ({ kind: 'bucket', id: b.id, title: b.title, sub: '버킷리스트', icon: '✨' })),
    ...members.filter((m) => m.name.toLowerCase().includes(q))
      .map((m): SearchResult => ({ kind: 'member', id: m.id, title: m.name, sub: '동행인', icon: '🧑‍🤝‍🧑' })),
  ].slice(0, 30)

  const go = (r: SearchResult) => {
    if (r.kind === 'trip') {
      const trip = trips.find((t) => t.id === r.id)
      if (trip) onOpenTrip(trip)
    } else if (r.kind === 'country' || r.kind === 'city') {
      onNavigate('countries')
    } else if (r.kind === 'place') {
      onNavigate('bookmarks', 'places')
    } else if (r.kind === 'bucket') {
      onNavigate('bookmarks', 'bucket')
    } else if (r.kind === 'member') {
      onNavigate('members')
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="search-palette" onClick={(e) => e.stopPropagation()}>
        <div className="search-palette-modes">
          <button type="button" className={`pill ${mode === 'search' ? 'active' : ''}`} onClick={() => setMode('search')}>
            🔍 검색
          </button>
          <button type="button" className={`pill ${mode === 'add' ? 'active' : ''}`} onClick={() => setMode('add')}>
            ＋ 빠른 등록
          </button>
        </div>

        {mode === 'search' ? (
          <>
            <input
              ref={inputRef}
              type="text"
              className="search-palette-input"
              placeholder="🔍 국가·도시·장소·버킷리스트·여행·동행인 검색…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="search-palette-results">
              {!loaded ? (
                <div className="empty">불러오는 중…</div>
              ) : q.length === 0 ? (
                <div className="empty">검색어를 입력해보세요.</div>
              ) : results.length === 0 ? (
                <div className="empty">검색 결과가 없어요.</div>
              ) : (
                results.map((r) => (
                  <button key={`${r.kind}-${r.id}`} type="button" className="search-result-row" onClick={() => go(r)}>
                    <span style={{ fontSize: 18 }}>{r.icon}</span>
                    <span className="grow">
                      <div style={{ fontWeight: 800 }}>{r.title}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{r.sub}</div>
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="search-palette-results" style={{ paddingTop: 8 }}>
            {QUICK_ADD_OPTIONS.map((o) => (
              <button key={o.target} type="button" className="search-result-row" onClick={() => { onQuickAdd(o.target); onClose() }}>
                <span style={{ fontSize: 18 }}>{o.icon}</span>
                <span className="grow">
                  <div style={{ fontWeight: 800 }}>{o.label}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{o.hint}</div>
                </span>
                <span className="muted">＋</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
