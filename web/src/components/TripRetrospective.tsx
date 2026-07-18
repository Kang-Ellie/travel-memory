import type { Trip } from '../../shared/types'
import { useEvents, useExpenses, useRates, useDayNotes } from '../queries'
import { computeBudgetSummary, fmtMoney } from '../settlement'
import { dayLabel } from './TripWorkspace'
import Thumb from './Thumb'

// 여행이 끝나면 이미 기록해둔 것들(지출·별점·일기)만 모아서 보여주는 회고 카드 —
// 새로 뭘 적을 필요 없이 조합만 하면 되는, "다녀온 여행"에 대한 자동 요약.
export default function TripRetrospective({ trip }: { trip: Trip }) {
  const { data: events = [] } = useEvents(trip.id)
  const { data: expenses = [] } = useExpenses(trip.id)
  const { data: rates = [] } = useRates(trip.id)
  const { data: dayNotes = [] } = useDayNotes(trip.id)

  const budget = computeBudgetSummary(trip, expenses, rates)
  const ratedEvents = events.filter((e) => e.rating != null)
  const maxRating = ratedEvents.length > 0 ? Math.max(...ratedEvents.map((e) => e.rating!)) : null
  const topPlaces = maxRating != null
    ? [...new Map(ratedEvents.filter((e) => e.rating === maxRating).map((e) => [e.place.id, e.place])).values()]
    : []
  const diaryDays = dayNotes
    .filter((d) => d.diary && d.diary.trim())
    .sort((a, b) => a.dayNumber - b.dayNumber)
  const photoCount = dayNotes.reduce((sum, d) => sum + d.photos.length, 0)

  if (events.length === 0 && expenses.length === 0 && diaryDays.length === 0) return null

  return (
    <div className="retro-card">
      <div className="dancheong-divider" />
      <div style={{ marginTop: 14 }}>
        <div className="base-list-eng">RETROSPECTIVE</div>
        <strong style={{ fontSize: 17 }}>🎞 여행 회고 — 다녀온 이야기</strong>

        <div className="retro-stats-row">
          <div className="retro-stat">
            <div className="muted">💰 총 지출</div>
            <div className="retro-stat-value">{fmtMoney(budget.spent, 'KRW')}</div>
          </div>
          {topPlaces.length > 0 && (
            <div className="retro-stat">
              <div className="muted">⭐ 최고 별점</div>
              <div className="retro-stat-value" style={{ fontSize: 15 }}>
                {'★'.repeat(maxRating!)}{'☆'.repeat(5 - maxRating!)}
              </div>
              <div className="muted">{topPlaces.map((p) => p.name).join(', ')}</div>
            </div>
          )}
          <div className="retro-stat">
            <div className="muted">📷 남긴 사진</div>
            <div className="retro-stat-value">{photoCount}장</div>
          </div>
        </div>

        {diaryDays.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="muted" style={{ marginBottom: 8, fontWeight: 700 }}>📔 일기 하이라이트</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {diaryDays.map((d) => (
                <div key={d.dayNumber} className="retro-diary-entry">
                  {d.photos[0] ? (
                    <Thumb path={d.photos[0].filePath}
                      style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{
                      width: 56, height: 56, borderRadius: 8, flexShrink: 0, fontSize: 22,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--pink-soft)',
                    }}>📔</div>
                  )}
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{d.dayNumber}일차 · {dayLabel(trip, d.dayNumber)}</div>
                    <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{d.diary}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
