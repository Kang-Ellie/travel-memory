import { useEffect, useState } from 'react'
import type { Trip, Expense, CurrencyRate, Member, TimelineEvent } from '../../shared/types'
import { api } from '../api'
import { computeBudgetSummary, fmtMoney } from '../settlement'
import { dday, tripStatus } from './TripsScreen'

// 여행을 열자마자(탭 상관없이) D-day·예산 소진율·오늘 일정·확인이 필요한 항목을
// 한 번에 보여주는 요약 띠. 각 값은 이미 다른 탭에서 계산하던 걸 재사용한다.
export default function TripSummaryCard({ trip }: { trip: Trip }) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [rates, setRates] = useState<CurrencyRate[]>([])
  const [participants, setParticipants] = useState<Member[]>([])
  const [events, setEvents] = useState<TimelineEvent[]>([])

  useEffect(() => {
    api.expenses.list(trip.id).then(setExpenses)
    api.rates.list(trip.id).then(setRates)
    api.tripMembers.list(trip.id).then(setParticipants)
    api.events.list(trip.id).then(setEvents)
  }, [trip.id])

  const budget = computeBudgetSummary(trip, expenses, rates)
  const status = tripStatus(trip)
  const unassignedCount = events.filter((e) => e.dayNumber == null).length

  const spanDays = Math.round(
    (new Date(trip.endDate + 'T00:00:00').getTime() - new Date(trip.startDate + 'T00:00:00').getTime()) / 86_400_000,
  ) + 1
  const nights = trip.nights != null ? trip.nights : Math.max(0, spanDays - 1)

  let todayDay: number | null = null
  if (status === 'ongoing') {
    const start = new Date(trip.startDate + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    todayDay = Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1
  }
  const todayEvents = todayDay != null
    ? events.filter((e) => e.dayNumber === todayDay).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    : []

  const warnings: string[] = []
  if (unassignedCount > 0) warnings.push(`📌 일차 미배정 일정 ${unassignedCount}건`)
  if (participants.length === 0) warnings.push('🧑‍🤝‍🧑 참여자 미설정')

  return (
    <div className="trip-summary-card">
      <div className="trip-summary-item">
        <div className="trip-summary-label">상태</div>
        <div className="trip-summary-value">{dday(trip)}</div>
      </div>

      <div className="trip-summary-item">
        <div className="trip-summary-label">일정</div>
        <div className="trip-summary-value">{nights}박 {spanDays}일</div>
      </div>

      {participants.length > 0 && (
        <div className="trip-summary-item">
          <div className="trip-summary-label">동행자</div>
          <div className="trip-summary-value">
            {participants.map((p) => `${p.emoji ? p.emoji + ' ' : ''}${p.name}`).join(', ')}
            <span className="muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 4 }}>
              {participants.length}명
            </span>
          </div>
        </div>
      )}

      {trip.budget > 0 && (
        <div className="trip-summary-item">
          <div className="trip-summary-label">예산 소진</div>
          <div className="trip-summary-value">
            {Math.round(budget.percent)}%
            <span className="muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 4 }}>
              {fmtMoney(budget.spent, 'KRW')} / {fmtMoney(budget.budget, 'KRW')}
            </span>
          </div>
        </div>
      )}

      {status === 'ongoing' && (
        <div className="trip-summary-item">
          <div className="trip-summary-label">오늘 · {todayDay}일차</div>
          <div className="trip-summary-value">
            {todayEvents.length === 0
              ? '일정 없음'
              : `${todayEvents[0].place.name}${todayEvents.length > 1 ? ` 외 ${todayEvents.length - 1}건` : ''}`}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="trip-summary-item">
          <div className="trip-summary-label">확인 필요</div>
          <div className="trip-summary-value warn">{warnings.join(' · ')}</div>
        </div>
      )}
    </div>
  )
}
