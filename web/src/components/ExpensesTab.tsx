import { useEffect, useState } from 'react'
import type { Trip, Member, Expense, CurrencyRate } from '../../shared/types'
import { api } from '../api'
import { fmtMoney } from '../settlement'
import { CATEGORY_COLOR } from '../categories'
import AddExpenseModal from './AddExpenseModal'
import BudgetBar from './BudgetBar'

// "7/15 (화)" — 장부의 날짜 헤더용
function dateLabel(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()} (${'일월화수목금토'[d.getDay()]})`
}

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
    const trimmed = newMemberName.trim()
    if (!trimmed) return
    const res = await api.members.create(trimmed)
    setNewMemberName('')
    if ('error' in res) {
      // 이미 같은 이름의 동행인이 있으면 새로 만드는 대신 그 사람을 그냥 선택해준다.
      const existing = allMembers.find((m) => m.name === trimmed)
      if (!existing) { alert(res.error); return }
      setSelMembers((prev) => new Set(prev).add(existing.id))
      return
    }
    setSelMembers((prev) => new Set(prev).add(res.id))
    api.members.list().then(setAllMembers)
  }

  // 장부(가계부)답게 날짜별로 묶는다 — 최신 날짜가 위.
  const byDate = new Map<string, Expense[]>()
  for (const e of [...expenses].sort((a, b) => b.spentAt.localeCompare(a.spentAt))) {
    const d = e.spentAt.slice(0, 10)
    const list = byDate.get(d) ?? []
    list.push(e)
    byDate.set(d, list)
  }
  const dayNumberOf = (date: string): number | null => {
    if (date < trip.startDate || date > trip.endDate) return null
    const diff = Math.round(
      (new Date(date + 'T00:00:00').getTime() - new Date(trip.startDate + 'T00:00:00').getTime()) / 86_400_000,
    )
    return diff + 1
  }
  const dayTotalLabel = (list: Expense[]): string => {
    const totals = new Map<string, number>()
    for (const e of list) totals.set(e.currency, (totals.get(e.currency) ?? 0) + e.amount)
    return [...totals.entries()].map(([c, t]) => fmtMoney(t, c)).join(' · ')
  }

  return (
    <div>
      <BudgetBar trip={trip} expenses={expenses} rates={rates} />

      {/* 툴바: 지출 기록 + 참여자 */}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {participants.length > 0 && (
          <button className="btn primary small" onClick={() => setShowAddExpense(true)}>＋ 지출 기록</button>
        )}
        <strong style={{ marginLeft: 4 }}>참여자:</strong>
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

      {showAddExpense && (
        <AddExpenseModal
          trip={trip}
          participants={participants}
          onClose={() => setShowAddExpense(false)}
          onAdded={() => { setShowAddExpense(false); refresh() }}
        />
      )}

      {/* 지출 장부 — 날짜별 그룹 */}
      <div className="section-gap">
        {expenses.length === 0 ? (
          <div className="empty">아직 지출 기록이 없어요.</div>
        ) : (
          [...byDate.entries()].map(([date, list]) => {
            const dayNum = dayNumberOf(date)
            return (
              <div key={date} className="ledger-day">
                <div className="ledger-day-head">
                  <strong>{dayNum != null ? `${dayNum}일차 · ` : ''}{dateLabel(date)}</strong>
                  <span className="muted">{list.length}건</span>
                  <span className="ledger-day-total">{dayTotalLabel(list)}</span>
                </div>
                {list.map((e) => (
                  <div key={e.id} className="ledger-row">
                    <span className="legend-dot" style={{ background: CATEGORY_COLOR[e.category as keyof typeof CATEGORY_COLOR] ?? '#999' }} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>
                        {e.description}
                        <span className="muted" style={{ fontWeight: 600, marginLeft: 6 }}>{e.category}</span>
                      </div>
                      {(e.paymentMethod || e.memo || e.purchaseItems || !e.isShared || e.isPrebooked) && (
                        <div className="muted" style={{ fontSize: 11 }}>
                          {!e.isShared && '🙋 개인지출 '}
                          {e.isPrebooked && '📌 사전예약 '}
                          {e.paymentMethod && `💳 ${e.paymentMethod} `}
                          {e.memo && `📝 ${e.memo} `}
                          {e.purchaseItems && `🧾 ${e.purchaseItems}`}
                        </div>
                      )}
                    </div>
                    <span className="muted" style={{ flexShrink: 0 }}>{e.payerName}</span>
                    <span className="ledger-amount">{fmtMoney(e.amount, e.currency)}</span>
                    <button className="x-btn" onClick={() => api.expenses.delete(e.id).then(refresh)}>×</button>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* 모바일: 여행 중 계산대 앞에서 바로 누르는 떠 있는 + 버튼 */}
      {participants.length > 0 && (
        <button type="button" className="fab" title="지출 기록" onClick={() => setShowAddExpense(true)}>＋</button>
      )}
    </div>
  )
}
