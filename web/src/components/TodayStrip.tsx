import { useState } from 'react'
import type { Trip, TimelineEvent, Member, Place } from '../../shared/types'
import { api } from '../api'
import { EXPENSE_CATEGORIES } from '../categories'
import { dayLabel } from './TripWorkspace'
import Window from './Window'
import Select from './Select'

function directionsUrl(place: Place): string | null {
  if (place.lat != null && place.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`
  }
  if (place.address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.address)}`
  }
  return null
}

// 여행 중일 때 앱을 열면 바로 보이는 "오늘" 요약 — 다음 장소 길찾기 + 3초 지출 입력 + 오늘 일기 진입.
export default function TodayStrip({
  trip, dayNumber, dayEvents, members, onOpenDiary, onChanged,
}: {
  trip: Trip; dayNumber: number; dayEvents: TimelineEvent[]; members: Member[]
  onOpenDiary: () => void; onChanged: () => void
}) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0])
  const [currency, setCurrency] = useState(() => localStorage.getItem(`todaystrip-currency-${trip.id}`) ?? 'KRW')
  const [paidBy, setPaidBy] = useState(() => localStorage.getItem(`todaystrip-paidby-${trip.id}`) ?? members[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const now = new Date().toTimeString().slice(0, 5)
  const nextEvent = dayEvents.find((e) => !e.plannedTime || e.plannedTime >= now)
  const nextUrl = nextEvent ? directionsUrl(nextEvent.place) : null

  const submitExpense = async () => {
    const amt = parseFloat(amount)
    const payer = paidBy || members[0]?.id
    if (!amt || amt <= 0 || !payer) return
    setSaving(true)
    await api.expenses.create({
      tripId: trip.id, eventId: null, amount: amt, currency, category,
      description: category, paidBy: payer, splitWith: members.map((m) => m.id),
      spentAt: new Date().toISOString().slice(0, 10),
      paymentMethod: null, memo: null, purchaseItems: null,
      isShared: true, isPrebooked: false,
    })
    localStorage.setItem(`todaystrip-currency-${trip.id}`, currency)
    localStorage.setItem(`todaystrip-paidby-${trip.id}`, payer)
    setAmount('')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    onChanged()
  }

  return (
    <div className="today-frame">
    <Window title="TODAY.EXE" color="pink">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '1 1 240px' }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>
            🌤 오늘은 {dayNumber}일차 · {dayLabel(trip, dayNumber)}
          </div>
          {nextEvent ? (
            <div>
              <div className="muted">다음 일정{nextEvent.plannedTime ? ` · ${nextEvent.plannedTime}` : ''}</div>
              <div style={{ fontWeight: 800, margin: '2px 0 8px' }}>{nextEvent.place.name}</div>
              {nextUrl && (
                <a className="btn small primary" href={nextUrl} target="_blank" rel="noreferrer">🧭 길찾기</a>
              )}
            </div>
          ) : (
            <div className="muted">
              {dayEvents.length === 0 ? '오늘 등록된 일정이 없어요.' : '오늘 일정을 다 둘러봤어요 🎉'}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn small" onClick={onOpenDiary}>📔 오늘 일기 쓰기</button>
          </div>
        </div>

        <div style={{ flex: '1 1 280px' }}>
          <div className="muted" style={{ marginBottom: 6 }}>💸 빠른 지출 입력</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="number" placeholder="금액" value={amount} style={{ width: 100 }}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitExpense()} />
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['KRW', 'JPY', 'USD', 'EUR', 'TWD', 'THB', 'VND'].map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            {members.length > 0 && (
              <Select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            )}
          </div>
          <div className="emoji-pick-row" style={{ marginTop: 8 }}>
            {EXPENSE_CATEGORIES.map((c) => (
              <button key={c} type="button" className="chip" onClick={() => setCategory(c)}
                style={{
                  cursor: 'pointer',
                  background: category === c ? 'var(--pink)' : 'var(--yellow-soft)',
                  color: category === c ? '#fff' : 'var(--ink)',
                }}>
                {c}
              </button>
            ))}
          </div>
          <button type="button" className="btn small primary" style={{ marginTop: 10 }}
            onClick={submitExpense} disabled={saving || !amount}>
            {saved ? '기록됨 ✓' : saving ? '저장 중…' : '＋ 기록'}
          </button>
        </div>
      </div>
    </Window>
    </div>
  )
}
