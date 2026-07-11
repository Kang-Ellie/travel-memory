import { useEffect, useState } from 'react'
import type { Trip, DashboardData } from '../../shared/types'
import { api, fileUrl } from '../api'
import { fmtMoney } from '../settlement'
import { tripCitiesLabel } from '../categories'
import { fmtRange, dday, tripStatus, type TripStatus } from './TripsScreen'
import { pad } from './DatePicker'
import Window from './Window'
import Lightbox from './Lightbox'
import FolderIcon, { type FolderColor } from './FolderIcon'

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

  useEffect(() => {
    api.trips.list().then(setTrips)
    api.dashboard.get().then(setData)
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

  const summary = data?.summary
  const gallery = data?.gallery ?? []
  const galleryUrls = gallery.map((g) => fileUrl(g.filePath))
  const activeTab = STATUS_TABS.find((s) => s.key === statusFilter)!
  const filteredTrips = trips.filter((t) => tripStatus(t) === statusFilter)

  return (
    <div>
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
            ) : (
              <div className="grid" style={{ marginTop: 12 }}>
                {filteredTrips.map((t) => (
                  <Window
                    key={t.id}
                    title={`TRIP_${t.title.replace(/\s+/g, '_').toUpperCase()}`}
                    color="pink"
                    footer={
                      <div className="card-footer">
                        <span>🧳 {dday(t)}</span>
                        <button className="open-link" onClick={() => onOpenTrip(t)}>OPEN →</button>
                      </div>
                    }
                  >
                    <h3 style={{ margin: '0 0 6px', fontSize: 19 }}>{t.title}</h3>
                    <div style={{ fontWeight: 700 }}>{fmtRange(t)}</div>
                    {t.cities.length > 0 && <div className="muted" style={{ marginTop: 4 }}>{tripCitiesLabel(t)}</div>}
                    {t.budget > 0 && <div className="muted" style={{ marginTop: 4 }}>💰 예산 {fmtMoney(t.budget, 'KRW')}</div>}
                  </Window>
                ))}
              </div>
            )}
          </Window>
        </div>
      </div>

      <Window title="TRIP_CALENDAR.EXE" color="green">
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
      </Window>

      <Window title="TRIP_GALLERY.EXE" color="yellow">
        {gallery.length === 0 ? (
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
          </>
        )}
        {galleryLightbox != null && (
          <Lightbox images={galleryUrls} index={galleryLightbox} onClose={() => setGalleryLightbox(null)} />
        )}
      </Window>
    </div>
  )
}
