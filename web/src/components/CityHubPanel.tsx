import { useEffect, useState } from 'react'
import type { CityPlaceSummary } from '../../shared/types'
import { api, fileUrl } from '../api'
import { fmtMoney } from '../settlement'
import { recommendedFieldLabel } from '../categories'
import { CATEGORY_EMOJI } from './PlacesScreen'

const CATEGORY_ORDER = ['맛집', '카페', '숙소', '명소', '쇼핑', '기타']
const RANK_MEDAL = ['🥇', '🥈', '🥉']

function score(s: CityPlaceSummary): number {
  return s.place.rating ?? s.avgVisitRating ?? 0
}

function PodiumSlot({ item, rank }: { item: CityPlaceSummary; rank: number }) {
  const heightClass = rank === 0 ? 'first' : rank === 1 ? 'second' : 'third'
  return (
    <div className="podium-slot">
      <span className="podium-medal">{RANK_MEDAL[rank]}</span>
      {item.place.coverPhoto ? (
        <img className="podium-photo" src={fileUrl(item.place.coverPhoto)} alt="" />
      ) : (
        <div className="podium-photo podium-photo-empty">{CATEGORY_EMOJI[item.place.category] ?? '📍'}</div>
      )}
      <div className="podium-name" title={item.place.name}>{item.place.name}</div>
      <div className="podium-meta">
        {score(item) > 0 ? `★${score(item).toFixed(1)}` : '평점 없음'} · 🔁{item.visitCount}
      </div>
      <div className={`podium-block ${heightClass}`}>{rank + 1}</div>
    </div>
  )
}

// 도시별 "나만의 미식 지도" — 저장 장소를 가봤어요/위시로 나누고, 카테고리별 TOP3 포디움과
// 평점·방문횟수·추천메뉴·누적지출 비교표를 보여준다. 다음에 이 도시를 또 갈 때 여기서 바로 훑는 용도.
export default function CityHubPanel({ cityId, cityName }: { cityId: string; cityName: string }) {
  const [items, setItems] = useState<CityPlaceSummary[] | null>(null)

  useEffect(() => { api.cities.places(cityId).then(setItems) }, [cityId])

  if (!items) return <div className="muted" style={{ padding: '8px 0' }}>불러오는 중…</div>
  if (items.length === 0) {
    return (
      <div className="empty">
        아직 이 도시에 저장된 장소가 없어요. [📍 장소 북마크]에서 국가/도시를 지정해 등록하면 여기 쌓여요.
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
        <div className="empty">아직 방문 기록이 있는 장소가 없어요. 동선에 추가하고 평점을 남기면 여기 랭킹이 생겨요.</div>
      )}

      {categories.map((cat) => {
        const list = byCategory.get(cat)!
        // 시상대는 2위-1위-3위 순서로 배치해야 실제 포디움처럼 보인다.
        const podiumOrder = [list[1], list[0], list[2]].filter((s): s is CityPlaceSummary => !!s)
        const podiumRanks = list.length >= 3 ? [1, 0, 2] : list.length === 2 ? [1, 0] : [0]
        return (
          <div key={cat} className="section-gap">
            <strong>{CATEGORY_EMOJI[cat] ?? ''} {cityName} {cat} TOP{Math.min(3, list.length)}</strong>
            <div className="podium">
              {podiumOrder.map((s, i) => <PodiumSlot key={s.place.id} item={s} rank={podiumRanks[i]} />)}
            </div>
            <div className="podium-base" />

            <div className="table-scroll">
              <table className="simple">
                <thead>
                  <tr>
                    <th>이름</th><th>★평점</th><th>🔁방문</th>
                    <th>{recommendedFieldLabel(cat)}</th><th className="num">누적지출</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s, i) => (
                    <tr key={s.place.id}>
                      <td>{i < 3 ? `${RANK_MEDAL[i]} ` : ''}{s.place.name}</td>
                      <td>{score(s) > 0 ? score(s).toFixed(1) : '—'}</td>
                      <td>{s.visitCount}</td>
                      <td>{s.place.recommendedMenu ?? '—'}</td>
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
          </div>
        )
      })}

      {wishlist.length > 0 && (
        <div className="section-gap">
          <strong>✨ 아직 안 가본 곳 ({wishlist.length})</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {wishlist.map((s) => (
              <span key={s.place.id} className="chip yellow">
                {CATEGORY_EMOJI[s.place.category] ?? ''} {s.place.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
