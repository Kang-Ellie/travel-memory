import { useEffect, useState } from 'react'
import type { Trip, DashboardData, ActivityLogEntry } from '../../shared/types'
import { api, fileUrl } from '../api'
import { fmtMoney } from '../settlement'
import { tripCitiesLabel } from '../categories'
import { fmtRange, dday, tripStatus, type TripStatus } from './TripsScreen'
import { pad } from './DatePicker'
import Window from './Window'
import Lightbox from './Lightbox'
import FolderIcon, { type FolderColor } from './FolderIcon'
import ActivityFeed from './ActivityFeed'
import TripTicket from './TripTicket'
import HanokSky from './HanokSky'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const GALLERY_PAGE = 24

const STATUS_TABS: Array<{ key: TripStatus; label: string; color: FolderColor }> = [
  { key: 'upcoming', label: '다가오는 여행', color: 'blue' },
  { key: 'ongoing', label: '여행 중', color: 'pink' },
  { key: 'past', label: '지난 여행', color: 'purple' },
]

export default function DashboardScreen({ onOpenTrip }: { onOpenTrip: (t: Trip) => void }) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [data, setData] = useState<DashboardData | null>(null)
  const [statusFilter, setStatusFilter] = useState<TripStatus>('upcoming')
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const [galleryLightbox, setGalleryLightbox] = useState<number | null>(null)
  const [calendarLightbox, setCalendarLightbox] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(GALLERY_PAGE)
  const [bottomView, setBottomView] = useState<'calendar' | 'gallery'>('calendar')
  const [activity, setActivity] = useState<ActivityLogEntry[]>([])
  const [showActivity, setShowActivity] = useState(false)

  useEffect(() => {
    api.trips.list().then(setTrips)
    api.dashboard.get().then(setData)
    api.activity.list(20).then(setActivity)
  }, [])

  const shiftMonth = (delta: number) => {
    let y = viewYear
    let m = viewMonth + delta
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setViewYear(y); setViewMonth(m)
  }

  const photoByDate = new Map((data?.calendarPhotos ?? []).map((p) => [p.date, p.filePath]))
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // 진행 중인 여행이 있으면 그걸, 없으면 제일 가까운 다가오는 여행을 히어로로 보여준다.
  const ongoingTrip = trips.find((t) => tripStatus(t) === 'ongoing')
  const nextUpcomingTrip = trips
    .filter((t) => tripStatus(t) === 'upcoming')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
  const heroTrip = ongoingTrip ?? nextUpcomingTrip ?? null
  const heroPhoto = heroTrip
    ? (data?.calendarPhotos ?? []).find((p) => p.date >= heroTrip.startDate && p.date <= heroTrip.endDate)?.filePath ?? null
    : null

  const summary = data?.summary
  const gallery = data?.gallery ?? []
  const galleryUrls = gallery.map((g) => fileUrl(g.filePath))
  const activeTab = STATUS_TABS.find((s) => s.key === statusFilter)!
  const filteredTrips = trips.filter((t) => tripStatus(t) === statusFilter)
  const pastByYear = statusFilter === 'past'
    ? Object.entries(
        filteredTrips.reduce<Record<string, Trip[]>>((acc, t) => {
          const year = t.startDate.slice(0, 4)
          ;(acc[year] ??= []).push(t)
          return acc
        }, {}),
      ).sort(([a], [b]) => Number(b) - Number(a))
    : null

  const renderTripCard = (t: Trip) => (
    <TripTicket key={t.id} trip={t} onOpen={() => onOpenTrip(t)} />
  )

  return (
    <div>
      <div className="dash-hero">
        <div>
          <div className="dash-hero-sub">NOW, HERE</div>
          <div className="dash-hero-title">지금, 여기</div>
        </div>
        <div className="dash-notif">
          <button
            type="button"
            className="dash-notif-btn"
            title="최근 활동"
            onClick={() => setShowActivity((v) => !v)}
          >
            🔔
            {activity.length > 0 && <span className="dash-notif-dot" />}
          </button>
          {showActivity && (
            <>
              <div className="dash-notif-backdrop" onClick={() => setShowActivity(false)} />
              <div className="dash-notif-panel">
                <div className="dash-notif-head">🔔 최근 활동</div>
                <div className="dash-notif-body">
                  <ActivityFeed items={activity} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {heroTrip && (
        <div className="ticket-hero">
          <div className="ticket-hero-photo-wrap">
            <HanokSky photo={heroPhoto ? fileUrl(heroPhoto) : null} />
          </div>
          <div className="ticket-hero-body">
            <div className={`ticket-hero-blob ${ongoingTrip ? 'red' : 'blue'}`} />
            <div className="ticket-hero-eyebrow">
              BOARDING PASS · {ongoingTrip ? 'NOW TRAVELING' : 'UPCOMING TRIP'}
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: 26 }}>{heroTrip.title}</h3>
            <div style={{ fontWeight: 700 }}>{fmtRange(heroTrip)}</div>
            {heroTrip.cities.length > 0 && (
              <div className="muted" style={{ marginTop: 4 }}>{tripCitiesLabel(heroTrip)}</div>
            )}
            <div className="dash-dday">{dday(heroTrip)}</div>
            <div style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={() => onOpenTrip(heroTrip)}>OPEN →</button>
            </div>
            <div className="ticket-hero-barcode" />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 280px' }}>
          <Window title="TRIP_SUMMARY.EXE" color="blue">
            {!summary ? (
              <div className="empty">불러오는 중…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>🌏 총 {summary.totalTrips}개의 기록 (국내 {summary.domesticTrips}, 해외 {summary.internationalTrips})</div>
                <div>✈️ 지금까지 {summary.totalDays}일 동안 여행했어요</div>
                <div>💬 {summary.bucketCount}개의 여행 버킷리스트가 있어요</div>
                <div>💰 지금까지 총 {fmtMoney(summary.totalSpentKrw, 'KRW')}을 썼어요</div>
                {summary.maxSpendTrip && (
                  <div className="muted">-- 최대 지출 여행 : {summary.maxSpendTrip.title} ({fmtMoney(summary.maxSpendTrip.amount, 'KRW')})</div>
                )}
                {summary.minSpendTrip && (
                  <div className="muted">-- 최소 지출 여행 : {summary.minSpendTrip.title} ({fmtMoney(summary.minSpendTrip.amount, 'KRW')})</div>
                )}
              </div>
            )}
          </Window>
        </div>

        <div style={{ flex: '2 1 420px' }}>
          <Window title="TRIP_LIST.EXE" color="purple">
            <div className="folder-tabs">
              {STATUS_TABS.map((tab) => (
                <button key={tab.key} className={`folder-tab ${statusFilter === tab.key ? 'active' : ''}`}
                  onClick={() => setStatusFilter(tab.key)}>
                  <FolderIcon color={tab.color} />
                  <span>{tab.label} ({trips.filter((t) => tripStatus(t) === tab.key).length})</span>
                </button>
              ))}
            </div>
            {filteredTrips.length === 0 ? (
              <div className="empty">{activeTab.label}이 없어요.</div>
            ) : pastByYear ? (
              pastByYear.map(([year, yearTrips]) => (
                <div key={year} className="section-gap">
                  <strong>{year}년 ({yearTrips.length})</strong>
                  <div className="grid" style={{ marginTop: 12 }}>
                    {yearTrips.map(renderTripCard)}
                  </div>
                </div>
              ))
            ) : (
              <div className="grid" style={{ marginTop: 12 }}>
                {filteredTrips.map(renderTripCard)}
              </div>
            )}
          </Window>
        </div>
      </div>

      <Window title={bottomView === 'calendar' ? 'TRIP_CALENDAR.EXE' : 'TRIP_GALLERY.EXE'} color={bottomView === 'calendar' ? 'green' : 'yellow'}>
        <div className="folder-tabs">
          <button className={`folder-tab ${bottomView === 'calendar' ? 'active' : ''}`} onClick={() => setBottomView('calendar')}>
            <FolderIcon color="green" />
            <span>📅 캘린더</span>
          </button>
          <button className={`folder-tab ${bottomView === 'gallery' ? 'active' : ''}`} onClick={() => setBottomView('gallery')}>
            <FolderIcon color="yellow" />
            <span>🖼 갤러리{gallery.length > 0 ? ` (${gallery.length})` : ''}</span>
          </button>
        </div>

        {bottomView === 'calendar' ? (
          <>
            <div className="row" style={{ justifyContent: 'center', gap: 16, marginBottom: 12 }}>
              <button type="button" className="btn small" onClick={() => shiftMonth(-1)}>‹</button>
              <strong>{viewYear}.{pad(viewMonth + 1)}</strong>
              <button type="button" className="btn small" onClick={() => shiftMonth(1)}>›</button>
            </div>
            <div className="dash-calendar-grid">
              {WEEKDAYS.map((w) => <span key={w} className="dash-calendar-weekday">{w}</span>)}
              {cells.map((day, i) => {
                const iso = day != null ? `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}` : null
                const photo = iso ? photoByDate.get(iso) : null
                return (
                  <div
                    key={i}
                    className={`dash-calendar-cell ${photo ? 'has-photo' : ''}`}
                    onClick={() => photo && setCalendarLightbox(photo)}
                  >
                    {photo && <img src={fileUrl(photo)} alt="" />}
                    {day != null && <span className="dash-calendar-daynum">{day}</span>}
                  </div>
                )
              })}
            </div>
            {calendarLightbox && (
              <Lightbox images={[fileUrl(calendarLightbox)]} index={0} onClose={() => setCalendarLightbox(null)} />
            )}
          </>
        ) : gallery.length === 0 ? (
          <div className="empty">아직 사진이 없어요.</div>
        ) : (
          <>
            <div className="dash-gallery-grid">
              {gallery.slice(0, visibleCount).map((g, i) => (
                <div key={g.id} className="dash-gallery-item" onClick={() => setGalleryLightbox(i)}>
                  <img src={fileUrl(g.filePath)} alt="" />
                  {g.caption && <div className="dash-gallery-caption">{g.caption}</div>}
                </div>
              ))}
            </div>
            {visibleCount < gallery.length && (
              <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
                <button type="button" className="btn small" onClick={() => setVisibleCount((v) => v + GALLERY_PAGE)}>
                  ↓ 더 보기
                </button>
              </div>
            )}
            {galleryLightbox != null && (
              <Lightbox images={galleryUrls} index={galleryLightbox} onClose={() => setGalleryLightbox(null)} />
            )}
          </>
        )}
      </Window>
    </div>
  )
}
