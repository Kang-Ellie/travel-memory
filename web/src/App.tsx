import { useEffect, useState } from 'react'
import type { Trip } from '../shared/types'
import { auth } from './api'
import Login from './Login'
import TripsScreen from './components/TripsScreen'
import TripWindow from './components/TripWindow'
import PlacesScreen from './components/PlacesScreen'
import CountriesScreen from './components/CountriesScreen'
import BucketListScreen from './components/BucketListScreen'
import MembersScreen from './components/MembersScreen'
import SettingsScreen from './components/SettingsScreen'

type Screen = 'trips' | 'places' | 'countries' | 'bucket' | 'members' | 'settings'

const NAV: Array<{ key: Screen; label: string }> = [
  { key: 'trips', label: '🏝 여행' },
  { key: 'places', label: '📍 장소 족보' },
  { key: 'countries', label: '🌍 국가·도시' },
  { key: 'bucket', label: '✨ 버킷리스트' },
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

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [screen, setScreen] = useState<Screen>('trips')
  const [openTrip, setOpenTrip] = useState<Trip | null>(null)
  const clock = useClock()

  useEffect(() => {
    auth.session().then((r) => setAuthed(r.authed)).catch(() => setAuthed(false))
  }, [])

  if (authed === null) return null
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />

  const tickerItems = (
    <>
      <span>♥ TRAVEL ON</span>
      <span className="pink">✦ 우리끼리 여행 기록</span>
      <span>♥ ANYWHERE, ANY DEVICE</span>
      <span className="pink">✦ 동선 · 리뷰 · 정산 · 바우처</span>
      <span>♥ MADE 4 US</span>
    </>
  )

  return (
    <div className="app">
      <div className="ticker">{tickerItems}{tickerItems}</div>

      <nav className="nav">
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
        <button className="pill" style={{ marginLeft: 'auto' }} onClick={() => auth.logout().then(() => setAuthed(false))}>
          🚪 로그아웃
        </button>
      </nav>

      <main className="content">
        {openTrip ? (
          <TripWindow trip={openTrip} onClose={() => setOpenTrip(null)} onTripChanged={setOpenTrip} />
        ) : (
          <>
            {screen === 'trips' && <TripsScreen onOpenTrip={setOpenTrip} />}
            {screen === 'places' && <PlacesScreen />}
            {screen === 'countries' && <CountriesScreen />}
            {screen === 'bucket' && <BucketListScreen />}
            {screen === 'members' && <MembersScreen />}
            {screen === 'settings' && <SettingsScreen />}
          </>
        )}
      </main>

      <footer className="taskbar">
        <span className="start-btn">🌸 start</span>
        <span>📁 travel_on — 우리만의 여행 OS</span>
        <span className="clock">{clock}</span>
      </footer>
    </div>
  )
}
