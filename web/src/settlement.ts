import type { Expense, Member, Trip, CurrencyRate } from '../shared/types'
import { EXPENSE_CATEGORIES } from './categories'

// 통화별 환율(1단위 = ?원) 맵으로 지출을 원화로 환산. 환율 미설정 통화는 null(집계 제외).
export function krwEquivalent(expense: Expense, rates: CurrencyRate[]): number | null {
  if (expense.currency === 'KRW') return expense.amount
  const rate = rates.find((r) => r.currency === expense.currency)
  return rate ? expense.amount * rate.krwPerUnit : null
}

function expenseDayNumber(trip: Trip, e: Expense): number {
  const s = new Date(trip.startDate + 'T00:00:00')
  const d = new Date(e.spentAt.slice(0, 10) + 'T00:00:00')
  return Math.round((d.getTime() - s.getTime()) / 86_400_000) + 1
}

export interface MemberBalance {
  memberId: string
  name: string
  paid: number
  share: number
  net: number // 양수 = 받을 돈, 음수 = 낼 돈
}

export interface Transfer {
  fromName: string
  toName: string
  amount: number
}

export interface CurrencySettlement {
  currency: string
  total: number
  balances: MemberBalance[]
  transfers: Transfer[]
}

export function computeSettlement(expenses: Expense[], members: Member[]): CurrencySettlement[] {
  const nameOf = new Map(members.map((m) => [m.id, m.name]))
  const byCurrency = new Map<string, Expense[]>()
  for (const e of expenses) {
    const list = byCurrency.get(e.currency) ?? []
    list.push(e)
    byCurrency.set(e.currency, list)
  }

  const result: CurrencySettlement[] = []
  for (const [currency, list] of byCurrency) {
    const bal = new Map<string, MemberBalance>()
    const ensure = (id: string): MemberBalance => {
      let b = bal.get(id)
      if (!b) {
        b = { memberId: id, name: nameOf.get(id) ?? '(삭제된 멤버)', paid: 0, share: 0, net: 0 }
        bal.set(id, b)
      }
      return b
    }

    let total = 0
    for (const e of list) {
      total += e.amount
      ensure(e.paidBy).paid += e.amount
      const splitters = e.splitWith.length > 0 ? e.splitWith : [e.paidBy]
      const share = e.amount / splitters.length
      for (const m of splitters) ensure(m).share += share
    }
    for (const b of bal.values()) b.net = b.paid - b.share

    // 그리디 이체 최소화: 받을 사람(양수)과 낼 사람(음수)을 매칭
    const creditors = [...bal.values()].filter((b) => b.net > 0.005).map((b) => ({ ...b }))
      .sort((a, b) => b.net - a.net)
    const debtors = [...bal.values()].filter((b) => b.net < -0.005).map((b) => ({ ...b, net: -b.net }))
      .sort((a, b) => b.net - a.net)

    const transfers: Transfer[] = []
    let ci = 0
    let di = 0
    while (ci < creditors.length && di < debtors.length) {
      const amount = Math.min(creditors[ci].net, debtors[di].net)
      transfers.push({ fromName: debtors[di].name, toName: creditors[ci].name, amount })
      creditors[ci].net -= amount
      debtors[di].net -= amount
      if (creditors[ci].net < 0.005) ci++
      if (debtors[di].net < 0.005) di++
    }

    result.push({ currency, total, balances: [...bal.values()], transfers })
  }

  return result.sort((a, b) => a.currency.localeCompare(b.currency))
}

export interface CategoryTotal {
  category: string
  amount: number
}

// 예산은 원화(KRW) 기준. 환율이 등록된 통화는 원화로 환산해서 합산하고,
// 환율이 없는 외화 지출은 (기존 동작과 동일하게) 집계에서 제외된다.
export function computeCategoryTotals(expenses: Expense[], rates: CurrencyRate[] = []): CategoryTotal[] {
  const sums = new Map<string, number>()
  for (const e of expenses) {
    const krw = krwEquivalent(e, rates)
    if (krw == null) continue
    sums.set(e.category, (sums.get(e.category) ?? 0) + krw)
  }
  return EXPENSE_CATEGORIES
    .map((c) => ({ category: c, amount: sums.get(c) ?? 0 }))
    .filter((c) => c.amount > 0)
}

export interface BudgetSummary {
  budget: number
  spent: number
  remaining: number
  percent: number // 0~100+ (초과 시 100 초과)
  unconvertedCount: number // 환율이 없어서 집계에서 빠진 외화 지출 건수
}

export function computeBudgetSummary(trip: Trip, expenses: Expense[], rates: CurrencyRate[] = []): BudgetSummary {
  let spent = 0
  let unconvertedCount = 0
  for (const e of expenses) {
    const krw = krwEquivalent(e, rates)
    if (krw == null) { unconvertedCount++; continue }
    spent += krw
  }
  const budget = trip.budget
  const percent = budget > 0 ? (spent / budget) * 100 : 0
  return { budget, spent, remaining: budget - spent, percent, unconvertedCount }
}

export interface DailySpend {
  total: number
  unconvertedCount: number
}

export function computeDailySpend(trip: Trip, expenses: Expense[], dayNumber: number, rates: CurrencyRate[] = []): DailySpend {
  let total = 0
  let unconvertedCount = 0
  for (const e of expenses) {
    if (expenseDayNumber(trip, e) !== dayNumber) continue
    const krw = krwEquivalent(e, rates)
    if (krw == null) { unconvertedCount++; continue }
    total += krw
  }
  return { total, unconvertedCount }
}

export interface DailyBudgetStatus {
  emoji: string
  label: string
  percent: number
}

// 하루 예산 대비 지출 비율에 따른 상태 등급 (0~30 / 31~50 / 51~70 / 71~100 / 101~)
export function dailyBudgetStatus(spent: number, budget: number | null): DailyBudgetStatus | null {
  if (!budget || budget <= 0) return null
  const percent = (spent / budget) * 100
  if (percent <= 30) return { emoji: '💖', label: '완전 여유', percent }
  if (percent <= 50) return { emoji: '🛎️', label: '절반 돌파', percent }
  if (percent <= 70) return { emoji: '🚨', label: '관리 필요', percent }
  if (percent <= 100) return { emoji: '🔥', label: '예산 꽉참', percent }
  return { emoji: '🚀', label: '이성 탈주', percent }
}

export function fmtMoney(amount: number, currency: string): string {
  const decimals = currency === 'KRW' || currency === 'JPY' || currency === 'VND' ? 0 : 2
  return `${new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(amount)} ${currency}`
}
