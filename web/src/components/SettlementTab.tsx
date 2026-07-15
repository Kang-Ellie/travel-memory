import { useEffect, useState } from 'react'
import type { Trip, Member, Expense } from '../../shared/types'
import { api } from '../api'
import { computeSettlement, fmtMoney } from '../settlement'

export default function SettlementTab({ trip }: { trip: Trip }) {
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])

  useEffect(() => {
    api.members.list().then(setAllMembers)
    api.expenses.list(trip.id).then(setExpenses)
  }, [trip.id])

  const settlements = computeSettlement(expenses, allMembers)

  if (expenses.length === 0) {
    return <div className="empty">아직 지출 기록이 없어요. [💸 지출] 탭에서 먼저 기록해보세요.</div>
  }

  return (
    <div>
      {settlements.map((s) => (
        <div key={s.currency} className="settle-box">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
            <span className="trip-doc-eyebrow" style={{ color: 'var(--stamp-green)' }}>
              SETTLEMENT · {s.currency}
            </span>
            <strong style={{ marginLeft: 'auto', fontSize: 15 }}>총 {fmtMoney(s.total, s.currency)}</strong>
          </div>

          {/* 결론 먼저 — 누가 누구에게 얼마 보내면 되는지 */}
          {s.transfers.length === 0 ? (
            <div style={{ fontWeight: 800, padding: '6px 0' }}>✅ 서로 주고받을 돈이 없어요!</div>
          ) : (
            <div className="transfer-cards">
              {s.transfers.map((t, i) => (
                <div key={i} className="transfer-card">
                  <span>{t.fromName}</span>
                  <span className="transfer-arrow">→</span>
                  <span>{t.toName}</span>
                  <strong className="transfer-amount">{fmtMoney(t.amount, s.currency)}</strong>
                </div>
              ))}
            </div>
          )}

          {/* 계산 근거는 접어서 */}
          <details className="settle-details">
            <summary>상세 내역 — 낸 돈 · 부담액 · 차액</summary>
            <div className="table-scroll" style={{ marginTop: 10 }}>
              <table className="simple">
                <thead>
                  <tr><th>이름</th><th className="num">낸 돈</th><th className="num">부담액</th><th className="num">차액</th></tr>
                </thead>
                <tbody>
                  {s.balances.map((b) => (
                    <tr key={b.memberId}>
                      <td style={{ fontWeight: 700 }}>{b.name}</td>
                      <td className="num">{fmtMoney(b.paid, s.currency)}</td>
                      <td className="num">{fmtMoney(b.share, s.currency)}</td>
                      <td className="num" style={{ fontWeight: 800, color: b.net >= 0 ? '#0a7d38' : '#d63031' }}>
                        {b.net >= 0 ? '+' : ''}{fmtMoney(b.net, s.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      ))}
    </div>
  )
}
