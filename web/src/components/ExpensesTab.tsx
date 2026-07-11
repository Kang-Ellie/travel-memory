import { useEffect, useState } from 'react'
import type { Trip, Member, Expense, CurrencyRate } from '../../shared/types'
import { api } from '../api'
import { computeSettlement, fmtMoney } from '../settlement'
import { CATEGORY_COLOR } from '../categories'
import AddExpenseModal from './AddExpenseModal'

export default function ExpensesTab({ trip }: { trip: Trip }) {
  const [participants, setParticipants] = useState<Member[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [rates, setRates] = useState<CurrencyRate[]>([])
  const [editingMembers, setEditingMembers] = useState(false)
  const [selMembers, setSelMembers] = useState<Set<string>>(new Set())
  const [newMemberName, setNewMemberName] = useState('')
  const [showAddExpense, setShowAddExpense] = useState(false)

  const refresh = () => {
    api.tripMembers.list(trip.id).then(setParticipants)
    api.members.list().then(setAllMembers)
    api.expenses.list(trip.id).then(setExpenses)
    api.rates.list(trip.id).then(setRates)
  }
  useEffect(refresh, [trip.id])

  useEffect(() => {
    setSelMembers(new Set(participants.map((m) => m.id)))
  }, [participants])

  const foreignCurrenciesUsed = [...new Set(expenses.map((e) => e.currency))].filter((c) => c !== 'KRW')
  const rateOf = (c: string) => rates.find((r) => r.currency === c)?.krwPerUnit
  const setRate = async (c: string, value: string) => {
    const n = parseFloat(value)
    if (!n || n <= 0) return
    await api.rates.set(trip.id, c, n)
    api.rates.list(trip.id).then(setRates)
  }

  const saveParticipants = async () => {
    await api.tripMembers.set(trip.id, [...selMembers])
    setEditingMembers(false)
    refresh()
  }

  const addMember = async () => {
    if (!newMemberName.trim()) return
    const res = await api.members.create(newMemberName.trim())
    setNewMemberName('')
    if ('error' in res) { alert(res.error); return }
    setSelMembers((prev) => new Set(prev).add(res.id))
    api.members.list().then(setAllMembers)
  }

  const settlements = computeSettlement(expenses, allMembers)

  return (
    <div>
      {/* 참여자 */}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <strong>참여자:</strong>
        {participants.length === 0 && <span className="muted">아직 없음 — 편집을 눌러 추가하세요</span>}
        {participants.map((m) => <span key={m.id} className="chip pink">{m.name}</span>)}
        <span style={{ marginLeft: 'auto' }}>
          <button className="btn small" onClick={() => setEditingMembers((v) => !v)}>
            {editingMembers ? '닫기' : '편집'}
          </button>
        </span>
      </div>
      {editingMembers && (
        <div className="row" style={{ flexWrap: 'wrap', background: 'var(--purple-soft)' }}>
          {allMembers.map((m) => (
            <label key={m.id} style={{ fontWeight: 700, display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="checkbox" checked={selMembers.has(m.id)}
                onChange={(e) => {
                  const next = new Set(selMembers)
                  e.target.checked ? next.add(m.id) : next.delete(m.id)
                  setSelMembers(next)
                }} />
              {m.name}
            </label>
          ))}
          <input type="text" value={newMemberName} placeholder="새 동행인 (예: 이모)" style={{ width: 140 }}
            onChange={(e) => setNewMemberName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMember()} />
          <button className="btn small" onClick={addMember}>＋ 추가</button>
          <button className="btn small primary" onClick={saveParticipants}>저장</button>
        </div>
      )}

      {/* 환율 설정 */}
      {foreignCurrenciesUsed.length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap', background: 'var(--blue-soft)' }}>
          <strong>환율:</strong>
          {foreignCurrenciesUsed.map((c) => (
            <span key={c} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              1 {c} =
              <input type="number" defaultValue={rateOf(c) ?? ''} placeholder="예: 9.5" style={{ width: 80 }}
                onBlur={(e) => setRate(c, e.target.value)} />
              원
            </span>
          ))}
          <span className="muted">여기서 설정한 환율로 예산·일별 지출이 원화로 환산돼요.</span>
        </div>
      )}

      {/* 지출 추가 */}
      {participants.length > 0 && (
        <div className="row">
          <button className="btn primary small" onClick={() => setShowAddExpense(true)}>＋ 지출 기록</button>
        </div>
      )}

      {showAddExpense && (
        <AddExpenseModal
          trip={trip}
          participants={participants}
          onClose={() => setShowAddExpense(false)}
          onAdded={() => { setShowAddExpense(false); refresh() }}
        />
      )}

      {/* 지출 목록 */}
      <div className="section-gap">
        {expenses.length === 0 ? (
          <div className="empty">아직 지출 기록이 없어요.</div>
        ) : (
          <div className="table-scroll">
            <table className="simple">
              <thead>
                <tr><th>날짜</th><th>내용</th><th>분류</th><th>낸 사람</th><th className="num">금액</th><th /></tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="muted">{e.spentAt.slice(0, 10)}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{e.description}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {!e.isShared && '🙋 개인지출 '}
                        {e.isPrebooked && '📌 사전예약 '}
                        {e.paymentMethod && `💳 ${e.paymentMethod} `}
                        {e.memo && `📝 ${e.memo} `}
                        {e.purchaseItems && `🧾 ${e.purchaseItems}`}
                      </div>
                    </td>
                    <td>
                      <span className="legend-item">
                        <span className="legend-dot" style={{ background: CATEGORY_COLOR[e.category as keyof typeof CATEGORY_COLOR] ?? '#999' }} />
                        {e.category}
                      </span>
                    </td>
                    <td>{e.payerName}</td>
                    <td className="num" style={{ fontWeight: 800 }}>{fmtMoney(e.amount, e.currency)}</td>
                    <td className="num">
                      <button className="btn small ghost" onClick={() => api.expenses.delete(e.id).then(refresh)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 정산 */}
      {settlements.map((s) => (
        <div key={s.currency} className="settle-box">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            🧮 정산 결과 — {s.currency} (총 {fmtMoney(s.total, s.currency)})
          </div>
          <div className="table-scroll" style={{ marginBottom: 10 }}>
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
          {s.transfers.length === 0 ? (
            <div style={{ fontWeight: 700 }}>✅ 서로 주고받을 돈이 없어요!</div>
          ) : s.transfers.map((t, i) => (
            <div key={i} className="transfer-line">
              💸 {t.fromName} → {t.toName} : {fmtMoney(t.amount, s.currency)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
