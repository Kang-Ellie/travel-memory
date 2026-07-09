import { EXPENSE_CATEGORIES, type ExpenseCategory } from '../shared/types'

// dataviz 스킬 검증 통과 팔레트 (light, surface #ffffff) — 고정 순서, 순환 금지.
// 항상 카테고리명을 함께 라벨로 표기해 색만으로 구분하지 않도록 함(대비 WARN 완화 조건).
export const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  식비: '#2a78d6',
  숙소: '#1baf7a',
  교통: '#eda100',
  쇼핑: '#008300',
  기타: '#4a3aa7',
}

export { EXPENSE_CATEGORIES }
