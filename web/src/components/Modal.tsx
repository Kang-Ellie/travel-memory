import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// 티켓 카드처럼 hover 시 transform이 걸리는 조상 안에서 모달을 열면, position:fixed가 뷰포트가
// 아니라 그 transform된 조상 기준으로 갇혀버린다(CSS containing block 규칙) — 카드 안에 모달이
// 끼어 보이던 버그의 원인. Select/DropdownMenu와 동일하게 body에 포털로 띄워서 항상 화면 전체
// 기준으로 뜨게 한다.
export default function Modal({
  title, onClose, children, headerActions,
}: { title: string; onClose: () => void; children: ReactNode; headerActions?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{title}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {headerActions}
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
