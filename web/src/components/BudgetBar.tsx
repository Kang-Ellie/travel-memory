import type { Trip, Expense } from '../../shared/types'
import { computeBudgetSummary, computeCategoryTotals, fmtMoney } from '../settlement'
import { CATEGORY_COLOR } from '../categories'

const TRACK = '#e7ecf3' // 블루 램프의 옅은 단계 (미터 트랙)
const WARN = '#fab219'
const CRIT = '#d03b3b'
const OK = '#2a78d6'

export default function BudgetBar({ trip, expenses }: { trip: Trip; expenses: Expense[] }) {
  const summary = computeBudgetSummary(trip, expenses)
  const categories = computeCategoryTotals(expenses)
  const fillColor = summary.percent >= 100 ? CRIT : summary.percent >= 80 ? WARN : OK
  const total = categories.reduce((s, c) => s + c.amount, 0) || 1

  return (
    <div className="budget-bar">
      <div className="budget-stats">
        <div className="budget-stat">
          <div className="budget-stat-label">예산</div>
          <div className="budget-stat-value">
            {summary.budget > 0 ? fmtMoney(summary.budget, 'KRW') : '미설정'}
          </div>
        </div>
        <div className="budget-stat">
          <div className="budget-stat-label">지출</div>
          <div className="budget-stat-value">{fmtMoney(summary.spent, 'KRW')}</div>
        </div>
        <div className="budget-stat">
          <div className="budget-stat-label">잔액</div>
          <div className="budget-stat-value" style={{ color: summary.remaining < 0 ? CRIT : undefined }}>
            {summary.budget > 0 ? fmtMoney(summary.remaining, 'KRW') : '—'}
          </div>
        </div>
      </div>

      {summary.budget > 0 && (
        <div className="meter" title={`${summary.percent.toFixed(0)}% 사용`}>
          <div className="meter-track" style={{ background: TRACK }}>
            <div
              className="meter-fill"
              style={{ width: `${Math.min(summary.percent, 100)}%`, background: fillColor }}
            />
          </div>
          <span className="meter-label" style={{ color: fillColor }}>
            {summary.percent > 100 ? `+${(summary.percent - 100).toFixed(0)}% 초과` : `${summary.percent.toFixed(0)}%`}
          </span>
        </div>
      )}

      {categories.length > 0 && (
        <>
          <div className="stacked-bar">
            {categories.map((c) => (
              <div
                key={c.category}
                style={{ width: `${(c.amount / total) * 100}%`, background: CATEGORY_COLOR[c.category as keyof typeof CATEGORY_COLOR] }}
              />
            ))}
          </div>
          <div className="category-legend">
            {categories.map((c) => (
              <span key={c.category} className="legend-item">
                <span className="legend-dot" style={{ background: CATEGORY_COLOR[c.category as keyof typeof CATEGORY_COLOR] }} />
                {c.category} {fmtMoney(c.amount, 'KRW')}
              </span>
            ))}
          </div>
        </>
      )}
      <div className="muted" style={{ marginTop: 4 }}>💡 예산·진행률은 원화(KRW) 지출만 기준으로 계산돼요.</div>
    </div>
  )
}
