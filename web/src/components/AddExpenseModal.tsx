import { useState } from 'react'
import type { Trip, Member } from '../../shared/types'
import { EXPENSE_CATEGORIES } from '../categories'
import { PAYMENT_METHOD_PRESETS } from '../../shared/types'
import { api } from '../api'
import Modal from './Modal'
import Select from './Select'
import DatePicker from './DatePicker'

const CURRENCIES = ['KRW', 'JPY', 'USD', 'EUR', 'TWD', 'THB', 'VND']

export default function AddExpenseModal({
  trip, participants, title = '지출 기록', defaultCategory = '기타', defaultPrebooked = false,
  eventId = null, defaultDescription = '', onClose, onAdded,
}: {
  trip: Trip
  participants: Member[]
  title?: string
  defaultCategory?: string
  defaultPrebooked?: boolean
  // 티켓(발렛·항공·숙소) 카드에서 "결제 기록하기"로 열면 그 일정에 지출이 바로 연결된다.
  eventId?: string | null
  defaultDescription?: string
  onClose: () => void
  onAdded: () => void
}) {
  const [description, setDescription] = useState(defaultDescription)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('KRW')
  const [category, setCategory] = useState<string>(defaultCategory)
  const [paidBy, setPaidBy] = useState(participants[0]?.id ?? '')
  const [splitWith, setSplitWith] = useState<Set<string>>(new Set(participants.map((m) => m.id)))
  const [spentAt, setSpentAt] = useState(trip.startDate)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [memo, setMemo] = useState('')
  const [purchaseItems, setPurchaseItems] = useState('')
  const [isShared, setIsShared] = useState(true)
  const [isPrebooked, setIsPrebooked] = useState(defaultPrebooked)
  const [showMoreFields, setShowMoreFields] = useState(false)

  const add = async () => {
    const amt = parseFloat(amount)
    if (!description.trim() || !amt || amt <= 0 || !paidBy) return
    if (isShared && splitWith.size === 0) return
    await api.expenses.create({
      tripId: trip.id, eventId, amount: amt, currency, category, description,
      paidBy, splitWith: isShared ? [...splitWith] : [paidBy], spentAt,
      paymentMethod: paymentMethod.trim() || null, memo: memo.trim() || null,
      purchaseItems: purchaseItems.trim() || null, isShared, isPrebooked,
    })
    onAdded()
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="form-row">
        <div className="field grow">
          <label>내용</label>
          <input type="text" value={description} placeholder="예: 왕복 항공권, OO호텔 3박"
            onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field" style={{ minWidth: 110 }}>
          <label>금액</label>
          <input type="number" value={amount} min={0} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field" style={{ minWidth: 90 }}>
          <label>통화</label>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </div>
      <div className="form-row">
        <div className="field" style={{ minWidth: 90 }}>
          <label>분류</label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div className="field">
          <label>낸 사람</label>
          <Select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {participants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </div>
        <div className="field">
          <label>날짜</label>
          <DatePicker value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
        </div>
        <div className="field">
          <label>결제수단 (선택)</label>
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="">— 선택 안함 —</option>
            {PAYMENT_METHOD_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>구분</label>
          <div style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
            <label style={{ fontWeight: 700, display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} /> 공동지출
            </label>
            <label style={{ fontWeight: 700, display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={isPrebooked} onChange={(e) => setIsPrebooked(e.target.checked)} /> 사전예약
            </label>
          </div>
        </div>
        {isShared && (
          <div className="field grow">
            <label>정산 대상</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '8px 0' }}>
              {participants.map((m) => (
                <label key={m.id} style={{ fontWeight: 700, display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
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
        )}
      </div>
      <button className="btn small ghost" type="button" onClick={() => setShowMoreFields((v) => !v)}>
        {showMoreFields ? '상세 닫기' : '＋ 메모·구매목록'}
      </button>
      {showMoreFields && (
        <div className="form-row" style={{ marginTop: 14 }}>
          <div className="field grow"><label>메모</label>
            <input type="text" value={memo} placeholder="자유 메모"
              onChange={(e) => setMemo(e.target.value)} /></div>
          <div className="field grow"><label>구매목록</label>
            <input type="text" value={purchaseItems} placeholder="예: 멘타이쥬 2인분, 음료 1개"
              onChange={(e) => setPurchaseItems(e.target.value)} /></div>
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <button className="btn primary" onClick={add}>기록 ✏️</button>
      </div>
    </Modal>
  )
}
