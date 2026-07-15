import { useEffect, useState } from 'react'
import type { CityPlaceSummary } from '../../shared/types'
import { api, fileUrl } from '../api'
import { fmtMoney } from '../settlement'

const CATEGORY_ORDER = ['맛집', '카페', '숙소', '명소', '쇼핑', '기타']
const RANK_MEDAL = ['🥇', '🥈', '🥉']

function score(s: CityPlaceSummary): number {
  return s.place.rating ?? s.avgVisitRating ?? 0
}

// 도시별 "나만의 미식 지도" — 저장 장소를 가봤어요/위시로 나누고, 카테고리별 TOP3와
// 평점·방문횟수·누적지출 비교표를 보여준다. 다음에 이 도시를 또 갈 때 여기서 바로 훑어보는 용도.
export default function CityHubPanel({ cityId, cityName }: { cityId: string; cityName: string }) {
  const [items, setItems] = useState<CityPlaceSummary[] | null>(null)

  useEffect(() => { api.cities.places(cityId).then(setItems) }, [cityId])

  if (!items) return <div className="muted" style={{ padding: '8px 0' }}>불러오는 중…</div>
  if (items.length === 0) {
    return (
      <div className="empty">
        아직 이 도시에 저장된 장소가 없어요. [📍 장소 족보]에서 국가/도시를 지정해 등록하면 여기 쌓여요.
      </div>
    )
  }

  const visited = items.filter((s) => s.visitCount > 0)
  const wishlist = items.filter((s) => s.visitCount === 0)
  const byCategory = new Map<string, CityPlaceSummary[]>()
  for (const s of visited) {
    const list = byCategory.get(s.place.category) ?? []
    list.push(s)
    byCategory.set(s.place.category, list)
  }
  for (const list of byCategory.values()) list.sort((a, b) => score(b) - score(a) || b.visitCount - a.visitCount)

  const categories = [
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...[...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
  ]

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        {cityName}에 저장한 장소 {items.length}개 · 가봤어요 {visited.length} · 위시 {wishlist.length}
      </p>

      {categories.length === 0 && (
        <div className="empty">아직 방문 기록이 있는 장소가 없어요. 동선에 추가하고 리뷰를 남기면 여기 랭킹이 생겨요.</div>
      )}

      {categories.map((cat) => {
        const list = byCategory.get(cat)!
        const top3 = list.slice(0, 3)
        return (
          <div key={cat} className="section-gap">
            <strong>{cat} TOP{Math.min(3, list.length)}</strong>
            <div className="mini-card-grid" style={{ marginTop: 8, marginBottom: 10 }}>
              {top3.map((s, i) => (
                <div key={s.place.id} className="card mini-card">
                  <div style={{ fontSize: 18 }}>{RANK_MEDAL[i]}</div>
                  {s.place.coverPhoto && (
                    <img src={fileUrl(s.place.coverPhoto)} alt=""
                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
                  )}
                  <div className="mini-card-name">{s.place.name}</div>
                  <div className="mini-card-meta">
                    {score(s) > 0 ? `★${score(s).toFixed(1)} · ` : ''}🔁{s.visitCount}
                  </div>
                </div>
              ))}
            </div>

            {list.length > 3 && (
              <div className="table-scroll">
                <table className="simple">
                  <thead>
                    <tr><th>이름</th><th>★평점</th><th>🔁방문</th><th className="num">누적지출</th></tr>
                  </thead>
                  <tbody>
                    {list.slice(3).map((s) => (
                      <tr key={s.place.id}>
                        <td>{s.place.name}</td>
                        <td>{score(s) > 0 ? score(s).toFixed(1) : '—'}</td>
                        <td>{s.visitCount}</td>
                        <td className="num">
                          {s.spentTotals.length > 0
                            ? s.spentTotals.map((t) => fmtMoney(t.total, t.currency)).join(' · ')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {wishlist.length > 0 && (
        <div className="section-gap">
          <strong>✨ 아직 안 가본 곳 ({wishlist.length})</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {wishlist.map((s) => (
              <span key={s.place.id} className="chip yellow">{s.place.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
