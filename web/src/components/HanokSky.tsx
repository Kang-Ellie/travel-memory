import { useEffect, useState } from 'react'

export type SkyPhase = 'dawn' | 'morning' | 'day' | 'dusk' | 'night'

const PHASE_LABEL: Record<SkyPhase, string> = {
  dawn: '새벽', morning: '아침', day: '낮', dusk: '노을', night: '밤',
}

export function skyPhaseOf(d: Date): SkyPhase {
  const h = d.getHours()
  if (h >= 5 && h < 7) return 'dawn'
  if (h >= 7 && h < 11) return 'morning'
  if (h >= 11 && h < 17) return 'day'
  if (h >= 17 && h < 19) return 'dusk'
  return 'night'
}

// 보딩패스 왼쪽 면에 깔리는 한옥 처마 하늘.
// 이미지 파일 없이 SVG로 그려서 시간대(새벽/아침/낮/노을/밤)에 따라 하늘·해·달·별이 바뀐다.
// 여행 사진이 있으면 하늘 뒤에 깔고 그 위에 하늘색을 얹어 시간대 분위기를 입힌다.
export default function HanokSky({ photo }: { photo?: string | null }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const phase = skyPhaseOf(now)
  const time = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  const starry = phase === 'night' || phase === 'dawn'
  const cloudy = phase === 'morning' || phase === 'day' || phase === 'dusk'

  return (
    <div className={`sky ${phase} ${photo ? 'has-photo' : ''}`}>
      {photo && <img className="sky-photo" src={photo} alt="" />}
      <div className="sky-grad" />
      {starry && <div className="sky-stars" />}
      <div className="sky-orb" />
      {cloudy && (
        <>
          <span className="sky-cloud c1" />
          <span className="sky-cloud c2" />
        </>
      )}

      <svg className="sky-roof" viewBox="0 0 300 220" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
        {/* 기와 지붕 슬로프 (처마 위쪽) */}
        <path
          className="roof-slope"
          d="M 0 0 C 60 6, 130 30, 196 66 C 224 81, 246 92, 262 96 L 246 108
             C 242 119, 234 124, 222 123 C 204 122, 178 113, 146 100 C 96 80, 46 66, 0 62 Z"
        />
        {/* 막새(기와 끝) — 처마 아래 테두리를 따라 둥글게 */}
        <g className="roof-tiles">
          {[[18, 121], [52, 128], [88, 137], [124, 145], [158, 151], [192, 155]].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6.5" />
          ))}
        </g>
        {/* 처마 (안쪽 면) — 끝이 위로 살짝 치켜올라간 곡선 */}
        <path
          className="roof-eave"
          d="M 0 62 C 46 66, 96 80, 146 100 C 178 113, 204 122, 222 123
             C 234 124, 242 119, 246 108 L 262 113 C 258 133, 246 146, 224 150
             C 186 157, 128 146, 70 132 C 46 126, 22 122, 0 120 Z"
        />
        {/* 단청 무늬 힌트 — 처마를 따라 흐르는 점선 */}
        <path
          className="roof-dancheong"
          d="M 4 92 C 50 97, 100 110, 150 128 C 180 139, 204 145, 220 145"
          fill="none"
          strokeDasharray="3 7"
          strokeLinecap="round"
        />
        {/* 풍경(風磬) — 처마 끝에 매달려 흔들리는 종과 물고기 */}
        <g className="sky-bell">
          <line x1="248" y1="139" x2="248" y2="157" />
          <path className="bell-body" d="M 240 158 L 256 158 L 258 171 Q 248 177 238 171 Z" />
          <ellipse className="bell-rim" cx="248" cy="173" rx="11" ry="2.6" />
          <line x1="248" y1="176" x2="248" y2="183" />
          <g className="bell-fish">
            <path d="M 243 189 Q 249 182 258 189 Q 249 196 243 189 Z" />
            <path d="M 243 189 L 236 184 L 236 194 Z" />
          </g>
        </g>
      </svg>

      <span className="sky-time">{time} · {PHASE_LABEL[phase]}</span>
    </div>
  )
}
