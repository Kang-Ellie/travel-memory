export interface InfoCardItem {
  icon: string
  label: string
  value: string | null | undefined
}

// "여행 기초정보" 카드 그리드 — 국가 도감·여행 BASE 탭에서 공용으로 쓰는 아이콘 카드 목록.
// 값이 없는 항목은 표시하지 않는다.
export default function InfoCardGrid({ items }: { items: InfoCardItem[] }) {
  const visible = items.filter((it): it is InfoCardItem & { value: string } => !!it.value)
  if (visible.length === 0) return null
  return (
    <div className="info-card-grid">
      {visible.map((it, i) => (
        <div key={i} className="info-card">
          <div className="info-card-head">
            <span className="info-card-icon">{it.icon}</span>
            <span className="info-card-label">{it.label}</span>
          </div>
          <div className="info-card-value">{it.value}</div>
        </div>
      ))}
    </div>
  )
}
