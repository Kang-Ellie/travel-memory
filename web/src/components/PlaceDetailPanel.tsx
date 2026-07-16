import { useEffect, useState } from 'react'
import type { PlaceDetail } from '../../shared/types'
import { api, fileUrl } from '../api'
import { fmtMoney } from '../settlement'
import PlaceMeta from './PlaceMeta'

export default function PlaceDetailPanel({ placeId }: { placeId: string }) {
  const [detail, setDetail] = useState<PlaceDetail | null>(null)

  useEffect(() => { api.places.detail(placeId).then(setDetail) }, [placeId])

  if (!detail) return <div className="muted" style={{ padding: '8px 0' }}>불러오는 중…</div>

  const metaBlock = (
    <div style={{ marginBottom: 12 }}>
      {detail.place.memo && <div className="muted">📝 {detail.place.memo}</div>}
      <PlaceMeta place={detail.place} />
    </div>
  )

  if (detail.visits.length === 0) {
    return (
      <div style={{ padding: '10px 4px' }}>
        {metaBlock}
        <div className="empty">아직 어떤 여행에서도 방문 기록이 없어요. 동선에 추가하면 여기 쌓여요.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '10px 4px' }}>
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
                {v.photos.map((p) => <img key={p.id} src={fileUrl(p.filePath)} alt="" loading="lazy" decoding="async"
                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--ink)' }} />)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
