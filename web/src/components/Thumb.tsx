import type { CSSProperties, MouseEventHandler } from 'react'
import { fileUrl, thumbUrl } from '../api'

// 목록/그리드용 축소 이미지. 업로드 시점에 함께 만들어진 480px 썸네일을 쓰고,
// (이 기능이 생기기 전에 올라간) 과거 사진이거나 썸네일 생성이 실패했던 경우엔
// 원본으로 자동 폴백한다 — 그래서 화면 대부분은 fileUrl 대신 이 컴포넌트를 쓴다.
// 라이트박스처럼 원본 확대가 목적인 자리에는 쓰지 않고 fileUrl을 그대로 쓴다.
export default function Thumb({ path, alt = '', className, style, onClick }: {
  path: string
  alt?: string
  className?: string
  style?: CSSProperties
  onClick?: MouseEventHandler<HTMLImageElement>
}) {
  return (
    <img
      src={thumbUrl(path)}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      onClick={onClick}
      onError={(e) => {
        const img = e.currentTarget
        if (img.dataset.fallback) return
        img.dataset.fallback = '1'
        img.src = fileUrl(path)
      }}
    />
  )
}
