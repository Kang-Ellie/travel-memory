import { useEffect, useState } from 'react'
import type { Trip } from '../shared/types'
import { auth } from './api'
import Login from './Login'
import DashboardScreen from './components/DashboardScreen'
import TripsScreen from './components/TripsScreen'
import TripWindow from './components/TripWindow'
import PlacesScreen from './components/PlacesScreen'
import CountriesScreen from './components/CountriesScreen'
import BucketListScreen from './components/BucketListScreen'
import SnsArchiveScreen from './components/SnsArchiveScreen'
import MembersScreen from './components/MembersScreen'
import SettingsScreen from './components/SettingsScreen'

type Screen = 'dashboard' | 'trips' | 'places' | 'countries' | 'bucket' | 'sns' | 'members' | 'settings'

const NAV: Array<{ key: Screen; label: string }> = [
  { key: 'dashboard', label: '🏠 대시보드' },
  { key: 'trips', label: '🏝 여행' },
  { key: 'places', label: '📍 장소 족보' },
  { key: 'countries', label: '🌍 국가·도시' },
  { key: 'bucket', label: '✨ 버킷리스트' },
  { key: 'sns', label: '🔗 SNS 아카이브' },
  { key: 'members', label: '👥 동행인' },
  { key: 'settings', label: '⚙️ 설정' },
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
  const clock = useClock()

  useEffect(() => {
    auth.session().then((r) => setAuthed(r.authed)).catch(() => setAuthed(false))
    const prefill = extractSharePrefill()
    if (prefill) {
      setSharePrefill(prefill)
      setScreen('sns')
      window.history.replaceState(null, '', '/')
    }
  }, [])

  if (authed === null) return null
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />

  return (
    <div className="app">
      <div className="ticker">
        <div className="ticker-sub">NOW, HERE</div>
        <div className="ticker-title">나를 채우는, 여백</div>
      </div>

      <div className="app-body">
        <nav className="nav sidebar-nav">
          {NAV.map((n) => (
            <button
              key={n.key}
              className={`pill ${screen === n.key && !openTrip ? 'active' : ''}`}
              onClick={() => { setScreen(n.key); setOpenTrip(null) }}
            >
              {n.label}
            </button>
          ))}
          {openTrip && <button className="pill active">✈️ {openTrip.title}</button>}
          <button className="pill logout" onClick={() => auth.logout().then(() => setAuthed(false))}>
            🚪 로그아웃
          </button>
        </nav>

        <main className="content">
          {openTrip ? (
            <TripWindow trip={openTrip} onClose={() => setOpenTrip(null)} onTripChanged={setOpenTrip} />
          ) : (
            <>
              {screen === 'dashboard' && <DashboardScreen onOpenTrip={setOpenTrip} />}
              {screen === 'trips' && <TripsScreen onOpenTrip={setOpenTrip} />}
              {screen === 'places' && <PlacesScreen />}
              {screen === 'countries' && <CountriesScreen />}
              {screen === 'bucket' && <BucketListScreen />}
              {screen === 'sns' && (
                <SnsArchiveScreen prefill={sharePrefill} onConsumedPrefill={() => setSharePrefill(null)} />
              )}
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
