import type { Trip, Expense, CurrencyRate } from '../../shared/types'
import { computeBudgetSummary, computeCategoryTotals, fmtMoney } from '../settlement'
import CategoryDonut from './CategoryDonut'

const TRACK = '#e7ecf3' // 블루 램프의 옅은 단계 (미터 트랙)
const WARN = '#fab219'
const CRIT = '#d03b3b'
const OK = '#2a78d6'

export default function BudgetBar({ trip, expenses, rates }: { trip: Trip; expenses: Expense[]; rates: CurrencyRate[] }) {
  const summary = computeBudgetSummary(trip, expenses, rates)
  const categories = computeCategoryTotals(expenses, rates)
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
        <div style={{ marginTop: 14 }}>
          <CategoryDonut
            categories={categories}
            size={132}
            centerLabel={
              <div>
                <div className="donut-hole-eyebrow">지출</div>
                <div>{fmtMoney(total, 'KRW')}</div>
              </div>
            }
          />
        </div>
      )}
      <div className="muted" style={{ marginTop: 4 }}>
        💡 예산·진행률은 원화(KRW) 환산 지출 기준이에요.
        {summary.unconvertedCount > 0 && ` 환율이 등록되지 않은 외화 지출 ${summary.unconvertedCount}건은 빠져있어요 — [🧾 지출] 탭에서 환율을 등록해주세요.`}
      </div>
    </div>
  )
}
