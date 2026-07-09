import type { Expense, Member, Trip } from '../shared/types'
import { EXPENSE_CATEGORIES } from './categories'

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

// 예산은 원화(KRW) 기준 — 여러 통화가 섞인 여행이면 KRW 지출만 집계 대상.
export function computeCategoryTotals(expenses: Expense[]): CategoryTotal[] {
  const sums = new Map<string, number>()
  for (const e of expenses) {
    if (e.currency !== 'KRW') continue
    sums.set(e.category, (sums.get(e.category) ?? 0) + e.amount)
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
}

export function computeBudgetSummary(trip: Trip, expenses: Expense[]): BudgetSummary {
  const spent = expenses.filter((e) => e.currency === 'KRW').reduce((s, e) => s + e.amount, 0)
  const budget = trip.budget
  const percent = budget > 0 ? (spent / budget) * 100 : 0
  return { budget, spent, remaining: budget - spent, percent }
}

export function fmtMoney(amount: number, currency: string): string {
  const decimals = currency === 'KRW' || currency === 'JPY' || currency === 'VND' ? 0 : 2
  return `${new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(amount)} ${currency}`
}
