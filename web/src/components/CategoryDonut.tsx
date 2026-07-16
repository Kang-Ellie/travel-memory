import type { ReactNode } from 'react'
import { CATEGORY_COLOR } from '../categories'
import { fmtMoney } from '../settlement'

// 카테고리별 지출을 원형(도넛)으로. conic-gradient로 파이를 그리고 가운데 구멍을 뚫어 도넛으로.
export default function CategoryDonut({
  categories, size = 128, thickness = 0.42, legend = true, compact = false, centerLabel,
}: {
  categories: Array<{ category: string; amount: number }>
  size?: number
  thickness?: number // 0~1 (도넛 구멍 비율)
  legend?: boolean
  compact?: boolean
  centerLabel?: ReactNode
}) {
  const total = categories.reduce((s, c) => s + c.amount, 0)
  if (total <= 0) return null

  let acc = 0
  const stops = categories
    .map((c) => {
      const start = (acc / total) * 360
      acc += c.amount
      const end = (acc / total) * 360
      const color = CATEGORY_COLOR[c.category as keyof typeof CATEGORY_COLOR] ?? '#c9c9c9'
      return `${color} ${start}deg ${end}deg`
    })
    .join(', ')

  return (
    <div className={`donut-wrap ${compact ? 'compact' : ''}`}>
      <div className="donut" style={{ width: size, height: size, background: `conic-gradient(${stops})` }}>
        <div className="donut-hole" style={{ inset: `${thickness * 50}%` }}>{centerLabel}</div>
      </div>
      {legend && (
        <div className={`donut-legend ${compact ? 'compact' : ''}`}>
          {categories.map((c) => (
            <span key={c.category} className="legend-item">
              <span className="legend-dot" style={{ background: CATEGORY_COLOR[c.category as keyof typeof CATEGORY_COLOR] }} />
              {c.category}
              {!compact && <span className="muted" style={{ marginLeft: 4 }}>{fmtMoney(c.amount, 'KRW')}</span>}
              <span className="donut-legend-pct">{Math.round((c.amount / total) * 100)}%</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
