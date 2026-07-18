// 목록이 로딩 중일 때 빈 화면(="아직 없어요")처럼 보이던 문제 — 데이터가 비어서가 아니라
// 아직 안 불러온 것뿐이라는 걸 알 수 있게 자리표시용 카드/행을 반짝이며 보여준다.
export function SkeletonGrid({ count = 6, minWidth = 220, height = 210 }: { count?: number; minWidth?: number; height?: number }) {
  return (
    <div className="skeleton-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))` }}>
      {Array.from({ length: count }, (_, i) => <div key={i} className="skeleton-block" style={{ height }} />)}
    </div>
  )
}

export function SkeletonRows({ count = 4, height = 52 }: { count?: number; height?: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => <div key={i} className="skeleton-block" style={{ height, marginBottom: 8 }} />)}
    </div>
  )
}
