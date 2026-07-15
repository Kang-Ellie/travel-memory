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

// 티켓 카드(탑승권/발렛/숙소)에서 공통으로 쓰는 날짜·시간 포맷
export function fmtDateTime(v: string | null): { time: string; date: string } {
  if (!v) return { time: '?', date: '' }
  const d = new Date(v)
  return {
    time: d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    date: d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }),
  }
}

// 장소의 "추천 메뉴" 필드는 카테고리마다 실제로 뜻하는 게 달라서(맛집은 메뉴, 명소는 놓치면
// 안 되는 포인트, 쇼핑은 아이템) 라벨을 카테고리별로 다르게 보여준다. 데이터는 같은 필드를 쓴다.
export function recommendedFieldLabel(category: string): string {
  if (category === '맛집' || category === '카페' || category === '숙소') return '🍽 추천 메뉴'
  if (category === '쇼핑') return '🛍 추천 아이템'
  return '📍 POINT'
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
