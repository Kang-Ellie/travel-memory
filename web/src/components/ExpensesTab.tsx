import { useEffect, useState } from 'react'
import type { Trip, Member, Expense } from '../../shared/types'
import { api } from '../api'
import { computeSettlement, fmtMoney } from '../settlement'
import { CATEGORY_COLOR, EXPENSE_CATEGORIES } from '../categories'

const CURRENCIES = ['KRW', 'JPY', 'USD', 'EUR', 'TWD', 'THB', 'VND']

export default function ExpensesTab({ trip }: { trip: Trip }) {
  const [participants, setParticipants] = useState<Member[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [editingMembers, setEditingMembers] = useState(false)
  const [selMembers, setSelMembers] = useState<Set<string>>(new Set())

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('KRW')
  const [category, setCategory] = useState<string>('기타')
  const [paidBy, setPaidBy] = useState('')
  const [splitWith, setSplitWith] = useState<Set<string>>(new Set())
  const [spentAt, setSpentAt] = useState(trip.startDate)
  const [newMemberName, setNewMemberName] = useState('')

  const refresh = () => {
    api.tripMembers.list(trip.id).then((ms) => {
      setParticipants(ms)
      setSelMembers(new Set(ms.map((m) => m.id)))
      if (ms.length > 0) {
        setPaidBy((prev) => (ms.some((m) => m.id === prev) ? prev : ms[0].id))
        setSplitWith((prev) => (prev.size > 0 ? prev : new Set(ms.map((m) => m.id))))
      }
    })
    api.members.list().then(setAllMembers)
    api.expenses.list(trip.id).then(setExpenses)
  }
  useEffect(refresh, [trip.id])

  const saveParticipants = async () => {
    await api.tripMembers.set(trip.id, [...selMembers])
    setEditingMembers(false)
    setSplitWith(new Set(selMembers))
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

  const addExpense = async () => {
    const amt = parseFloat(amount)
    if (!description.trim() || !amt || amt <= 0 || !paidBy || splitWith.size === 0) return
    await api.expenses.create({
      tripId: trip.id, eventId: null, amount: amt, currency, category, description,
      paidBy, splitWith: [...splitWith], spentAt,
    })
    setDescription(''); setAmount('')
    refresh()
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

      {/* 지출 추가 */}
      {participants.length > 0 && (
        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field grow">
            <label>내용</label>
            <input type="text" value={description} placeholder="예: 점심 - 멘타이쥬"
              onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field" style={{ minWidth: 110 }}>
            <label>금액</label>
            <input type="number" value={amount} min={0} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="field" style={{ minWidth: 90 }}>
            <label>통화</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 90 }}>
            <label>분류</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>낸 사람</label>
            <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {participants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>날짜</label>
            <input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
          </div>
          <div className="field">
            <label>정산 대상</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 0' }}>
              {participants.map((m) => (
                <label key={m.id} style={{ fontWeight: 700, display: 'flex', gap: 3, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={splitWith.has(m.id)}
                    onChange={(e) => {
                      const next = new Set(splitWith)
                      e.target.checked ? next.add(m.id) : next.delete(m.id)
                      setSplitWith(next)
                    }} />
                  {m.name}
                </label>
              ))}
            </div>
          </div>
          <button className="btn primary" onClick={addExpense}>기록 ✏️</button>
        </div>
      )}

      {/* 지출 목록 */}
      <div className="section-gap">
        {expenses.length === 0 ? (
          <div className="empty">아직 지출 기록이 없어요.</div>
        ) : (
          <table className="simple">
            <thead>
              <tr><th>날짜</th><th>내용</th><th>분류</th><th>낸 사람</th><th className="num">금액</th><th /></tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="muted">{e.spentAt.slice(0, 10)}</td>
                  <td style={{ fontWeight: 700 }}>{e.description}</td>
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
        )}
      </div>

      {/* 정산 */}
      {settlements.map((s) => (
        <div key={s.currency} className="settle-box">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            🧮 정산 결과 — {s.currency} (총 {fmtMoney(s.total, s.currency)})
          </div>
          <table className="simple" style={{ marginBottom: 10 }}>
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
