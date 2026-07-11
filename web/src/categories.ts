import { EXPENSE_CATEGORIES, type ExpenseCategory, type Trip } from '../shared/types'

// dataviz 스킬 검증 통과 팔레트 (light, surface #ffffff) — 고정 순서, 순환 금지.
// 항상 카테고리명을 함께 라벨로 표기해 색만으로 구분하지 않도록 함(대비 WARN 완화 조건).
export const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  맛집: '#2a78d6',
  카페: '#8a5a2b',
  숙소: '#1baf7a',
  교통: '#eda100',
  쇼핑: '#008300',
  관광: '#0f9ba0',
  면세점: '#a23bc4',
  선물: '#d6336c',
  기타: '#4a3aa7',
}

export { EXPENSE_CATEGORIES }

export function flagEmoji(code: string | null | undefined): string {
  if (!code || code.trim().length !== 2) return '🌐'
  const upper = code.trim().toUpperCase()
  const points = [...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  return String.fromCodePoint(...points)
}

// 장소 평점(0~5, 0.5 단위) 색상 — 낮을수록 빨강, 높을수록 초록
export function ratingColor(n: number): string {
  if (n >= 4.5) return '#0a7d38'
  if (n >= 3.5) return '#2a78d6'
  if (n >= 2.5) return '#fab219'
  return '#d03b3b'
}

// 여행에 연결된 국가·도시를 "🇯🇵 일본 · 후쿠오카, 벳푸  /  🇰🇷 한국 · 서울" 형태로 요약
export function tripCitiesLabel(trip: Trip): string {
  if (trip.cities.length === 0) return ''
  const byCountry = new Map<string, string[]>()
  for (const c of trip.cities) {
    const key = `${flagEmoji(c.countryCode)} ${c.countryName}`
    const list = byCountry.get(key) ?? []
    list.push(c.name)
    byCountry.set(key, list)
  }
  return [...byCountry.entries()].map(([country, names]) => `${country} · ${names.join(', ')}`).join('  /  ')
}
