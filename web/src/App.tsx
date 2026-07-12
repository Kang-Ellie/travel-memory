import { useEffect, useState } from 'react'
import type { Trip } from '../shared/types'
import { auth, api } from './api'
import { flagEmoji } from './categories'
import Login from './Login'
import DashboardScreen from './components/DashboardScreen'
import TripsScreen from './components/TripsScreen'
import TripWindow from './components/TripWindow'
import BookmarksScreen from './components/BookmarksScreen'
import CountriesScreen from './components/CountriesScreen'
import MembersScreen from './components/MembersScreen'
import SettingsScreen from './components/SettingsScreen'

type Screen = 'dashboard' | 'trips' | 'bookmarks' | 'countries' | 'members' | 'settings'

const NAV: Array<{ key: Screen; icon: string; label: string; eng: string }> = [
  { key: 'dashboard', icon: '🏠', label: '대시보드', eng: 'HOME' },
  { key: 'trips', icon: '🏝', label: '여행', eng: 'TRIPS' },
  { key: 'bookmarks', icon: '📚', label: '북마크', eng: 'BOOKMARKS' },
  { key: 'countries', icon: '🌍', label: '국가 도감', eng: 'ATLAS' },
  { key: 'members', icon: '👥', label: '동행인', eng: 'PEOPLE' },
  { key: 'settings', icon: '⚙️', label: '설정', eng: 'SETTINGS' },
]

function useClock(): string {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(t)
  }, [])
  return now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export interface SharePrefill { title: string; url: string }

// 안드로이드 PWA 공유 대상(share_target)으로 들어온 요청에서 링크·제목을 뽑아낸다.
// 인스타 등은 링크를 url이 아니라 text에 실어 보내는 경우가 많아 text에서도 URL을 찾는다.
function extractSharePrefill(): SharePrefill | null {
  if (window.location.pathname !== '/share-target') return null
  const params = new URLSearchParams(window.location.search)
  const rawTitle = (params.get('title') ?? '').trim()
  const rawText = (params.get('text') ?? '').trim()
  const rawUrl = (params.get('url') ?? '').trim()
  const urlMatch = `${rawUrl} ${rawText} ${rawTitle}`.match(/https?:\/\/\S+/)
  const url = /^https?:\/\//.test(rawUrl) ? rawUrl : (urlMatch ? urlMatch[0] : '')
  if (!url) return null
  const title = rawTitle || rawText.replace(url, '').trim()
  return { title, url }
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [openTrip, setOpenTrip] = useState<Trip | null>(null)
  const [sharePrefill, setSharePrefill] = useState<SharePrefill | null>(null)
  const [visitedFlags, setVisitedFlags] = useState<string[]>([])
  const clock = useClock()

  useEffect(() => {
    auth.session().then((r) => setAuthed(r.authed)).catch(() => setAuthed(false))
    const prefill = extractSharePrefill()
    if (prefill) {
      setSharePrefill(prefill)
      setScreen('bookmarks')
      window.history.replaceState(null, '', '/')
    }
    Promise.all([api.countries.list(), api.cities.list()]).then(([countries, cities]) => {
      const visitedCountryIds = new Set(cities.filter((c) => c.visited).map((c) => c.countryId))
      setVisitedFlags(countries.filter((c) => visitedCountryIds.has(c.id)).map((c) => flagEmoji(c.code)))
    })
  }, [])

  if (authed === null) return null
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />

  return (
    <div className="app">
      <div className="app-body">
        <nav className="nav sidebar-nav">
          <div className="sidebar-logo">YEOBAEK</div>
          {NAV.map((n) => (
            <button
              key={n.key}
              className={`sidebar-nav-btn ${screen === n.key && !openTrip ? 'active' : ''}`}
              onClick={() => { setScreen(n.key); setOpenTrip(null) }}
            >
              <span className="sidebar-nav-icon">{n.icon}</span>
              <span className="sidebar-nav-text">
                <span className="sidebar-nav-label">{n.label}</span>
                <span className="sidebar-nav-eng">{n.eng}</span>
              </span>
            </button>
          ))}
          {visitedFlags.length > 0 && (
            <div className="sidebar-flags-row" title="내가 간 나라">
              {visitedFlags.map((f, i) => <span key={i}>{f}</span>)}
            </div>
          )}
          {openTrip && (
            <button className="sidebar-nav-btn active">
              <span className="sidebar-nav-icon">✈️</span>
              <span className="sidebar-nav-text">
                <span className="sidebar-nav-label">{openTrip.title}</span>
                <span className="sidebar-nav-eng">TRIP</span>
              </span>
            </button>
          )}
          <button className="sidebar-nav-btn logout" onClick={() => auth.logout().then(() => setAuthed(false))}>
            <span className="sidebar-nav-icon">🚪</span>
            <span className="sidebar-nav-text">
              <span className="sidebar-nav-label">로그아웃</span>
              <span className="sidebar-nav-eng">LOGOUT</span>
            </span>
          </button>
        </nav>

        <main className="content">
          {openTrip ? (
            <TripWindow trip={openTrip} onClose={() => setOpenTrip(null)} onTripChanged={setOpenTrip} />
          ) : (
            <>
              {screen === 'dashboard' && <DashboardScreen onOpenTrip={setOpenTrip} />}
              {screen === 'trips' && <TripsScreen onOpenTrip={setOpenTrip} />}
              {screen === 'bookmarks' && (
                <BookmarksScreen prefill={sharePrefill} onConsumedPrefill={() => setSharePrefill(null)} />
              )}
              {screen === 'countries' && <CountriesScreen />}
              {screen === 'members' && <MembersScreen />}
              {screen === 'settings' && <SettingsScreen />}
            </>
          )}
        </main>
      </div>

      <footer className="taskbar">
        <span className="start-btn">🌸 start</span>
        <span>📁 travel_on — 우리만의 여행 OS</span>
        <span className="clock">{clock}</span>
      </footer>
    </div>
  )
}
