import { useEffect, useState } from 'react'
import type { PlaceDetail } from '../../shared/types'
import { api } from '../api'
import { fmtMoney } from '../settlement'
import { flagEmoji, ratingColor, displayRating, googleMapsUrl, CATEGORY_EMOJI, CATEGORY_PASTEL } from '../categories'
import PlaceMeta from './PlaceMeta'
import Thumb from './Thumb'

export default function PlaceDetailPanel({ placeId }: { placeId: string }) {
  const [detail, setDetail] = useState<PlaceDetail | null>(null)

  useEffect(() => { api.places.detail(placeId).then(setDetail) }, [placeId])

  if (!detail) return <div className="muted" style={{ padding: '8px 0' }}>불러오는 중…</div>

  const { place } = detail
  const shownRating = displayRating(place)
  // 북마크에서 카드를 눌렀을 때 방문 기록만 보이고 정작 "여기가 어떤 곳인지"는 안 보이던 문제를 고치려고,
  // 장소 족보 카드에 있던 기본 정보(사진·평점·주소·추천여부)를 상세 패널 맨 위에도 그대로 보여준다.
  const headerBlock = (
    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
      {place.coverPhoto ? (
        <Thumb path={place.coverPhoto} style={{ width: 88, height: 88, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 88, height: 88, borderRadius: 10, flexShrink: 0, fontSize: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: CATEGORY_PASTEL[place.category] ?? 'var(--purple-soft)',
        }}>
          {CATEGORY_EMOJI[place.category] ?? '📍'}
        </div>
      )}
      <div className="grow" style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
          <span className="chip blue">{place.category}</span>
          {shownRating != null && (
            <span style={{ fontWeight: 800, color: ratingColor(shownRating) }} title={place.rating == null ? '방문 평균 평점' : '내가 매긴 종합 평점'}>
              ★ {shownRating.toFixed(1)}
            </span>
          )}
          {place.recommend === true && <span className="chip green">👍 추천</span>}
          {place.recommend === false && <span className="chip pink">👎 비추천</span>}
          {place.visitCount > 0 && <span className="chip purple">🔁 {place.visitCount}번 방문</span>}
        </div>
        {place.countryName && (
          <div className="muted">{flagEmoji(place.countryCode)} {place.cityName ?? place.countryName}</div>
        )}
        <div className="muted">
          {googleMapsUrl(place) ? (
            <a className="plain-link" href={googleMapsUrl(place)!} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              {place.address || '지도에서 보기'}
            </a>
          ) : (place.address || '주소 없음')}
        </div>
      </div>
    </div>
  )

  const metaBlock = (
    <div style={{ marginBottom: 12 }}>
      {place.memo && <div className="muted">📝 {place.memo}</div>}
      <PlaceMeta place={place} />
    </div>
  )

  if (detail.visits.length === 0) {
    return (
      <div style={{ padding: '10px 4px' }}>
        {headerBlock}
        {metaBlock}
        <div className="empty">아직 어떤 여행에서도 방문 기록이 없어요. 동선에 추가하면 여기 쌓여요.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '10px 4px' }}>
      {headerBlock}
      {metaBlock}
      {detail.expenseTotals.length > 0 && (
        <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {detail.expenseTotals.map((t) => (
            <span key={t.currency} className="chip pink">💰 누적 지출 {fmtMoney(t.total, t.currency)}</span>
          ))}
        </div>
      )}
      {detail.visits.map((v) => (
        <div key={v.id} className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="grow">
            <div style={{ fontWeight: 800 }}>
              {v.tripTitle} · {v.dayNumber != null ? `${v.dayNumber}일차` : '일차 미배정'}
              {v.rating != null && <span style={{ marginLeft: 6 }}>{'★'.repeat(v.rating)}{'☆'.repeat(5 - v.rating)}</span>}
            </div>
            {v.mustTry && <div className="chip pink" style={{ marginTop: 4 }}>🌟 {v.mustTry}</div>}
            {v.review && <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{v.review}</div>}
            {v.photos.length > 0 && (
              <div className="photo-strip">
                {v.photos.map((p) => <Thumb key={p.id} path={p.filePath}
                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--ink)' }} />)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
