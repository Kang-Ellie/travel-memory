import type { ReactNode } from 'react'

interface WindowProps {
  title: string
  color?: 'pink' | 'blue' | 'purple' | 'green' | 'yellow'
  onClose?: () => void
  headerActions?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

// 트래블 도큐먼트 스타일의 "서류 시트" 컨테이너.
// 예전 레트로 창 시절의 "OUR_PLACES.EXE" 같은 제목 문자열이 화면 곳곳에 남아 있어서,
// 호출부를 전부 고치는 대신 여기서 한 번에 서류 라벨("OUR PLACES")로 변환한다.
export default function Window({ title, color = 'pink', onClose, headerActions, children, footer }: WindowProps) {
  const displayTitle = title.replace(/\.EXE$/i, '').replace(/_/g, ' ')
  return (
    <div className="window">
      <div className={`window-titlebar ${color === 'pink' ? '' : color}`}>
        <span className="window-title">{displayTitle}</span>
        {headerActions}
        {onClose && (
          <button className="window-close" onClick={onClose} title="닫기">×</button>
        )}
      </div>
      <div className="window-body">{children}</div>
      {footer}
    </div>
  )
}
