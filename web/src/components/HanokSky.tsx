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

// 처마 곡선 위의 지점들 — 기와 골(수키와)·막새·단청 꽃문양이 전부 이 x좌표에 맞춰 정렬된다.
// y는 막새가 놓이는 곡선 E(-26) 위의 값.
const EAVE_POINTS: Array<[number, number]> = [
  [70, 134], [100, 139], [134, 138], [170, 130], [210, 119],
  [255, 101], [300, 81], [350, 58], [400, 32],
]

// 보딩패스 왼쪽 면의 한옥 처마 하늘.
// 이미지 파일 없이 SVG로 그린 단청 처마 — 시간대(새벽/아침/낮/노을/밤)에 따라
// 하늘·해·달·별·구름과 단청 색조가 함께 바뀐다. 처마 끝 풍경(風磬)은 천천히 흔들린다.
export default function HanokSky({ photo }: { photo?: string | null }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const phase = skyPhaseOf(now)
  const time = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  const starry = phase === 'night' || phase === 'dawn'
  const cloudy = phase !== 'night'

  return (
    <div className={`sky ${phase} ${photo ? 'has-photo' : ''}`}>
      {photo && <img className="sky-photo" src={photo} alt="" />}
      <div className="sky-grad" />
      {starry && <div className="sky-stars" />}

      <svg className="sky-art" viewBox="0 0 420 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <filter id="hanok-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        {/* 해 / 달 — 전통 회화처럼 납작한 원 */}
        {phase === 'night' ? (
          <g className="orb-moon">
            <circle className="orb-glow" cx="70" cy="58" r="38" filter="url(#hanok-glow)" />
            <circle className="orb" cx="70" cy="58" r="27" />
            <circle className="crater" cx="81" cy="50" r="6" />
            <circle className="crater" cx="63" cy="69" r="4.5" />
            <circle className="crater" cx="59" cy="47" r="3" />
          </g>
        ) : (
          <g className="orb-sun">
            <circle className="orb-glow" cx="70" cy="58" r="36" filter="url(#hanok-glow)" />
            <circle className="orb" cx="70" cy="58" r="26" />
          </g>
        )}

        {/* 서운(상서구름) — 전통 문양의 말린 구름 */}
        {/* 바깥 g가 위치·크기를, 안쪽 g가 흘러가는 애니메이션을 맡는다
            (CSS transform이 SVG transform 속성을 덮어쓰기 때문에 분리) */}
        {cloudy && (
          <>
            <g transform="translate(6 84) scale(0.9)">
              <g className="cloud c1">
                <path d="M 8 22 C 8 11, 23 7, 29 16 C 36 5, 54 8, 55 20 C 66 20, 70 33, 57 35 L 14 35 C 1 35, 0 24, 8 22 Z" />
                <path className="cloud-curl" d="M 24 23 a 5 5 0 1 1 -6.5 -4.6" fill="none" />
              </g>
            </g>
            <g transform="translate(112 36) scale(0.62)">
              <g className="cloud c2">
                <path d="M 8 22 C 8 11, 23 7, 29 16 C 36 5, 54 8, 55 20 C 66 20, 70 33, 57 35 L 14 35 C 1 35, 0 24, 8 22 Z" />
                <path className="cloud-curl" d="M 24 23 a 5 5 0 1 1 -6.5 -4.6" fill="none" />
              </g>
            </g>
          </>
        )}

        {/* 산 — 뒤쪽 능선부터 겹쳐서 */}
        <path className="mtn back" d="M 0 260 L 0 240 L 52 212 L 104 244 L 152 218 L 214 250 L 268 216 L 340 246 L 420 220 L 420 260 Z" />
        <path className="mtn front" d="M 0 260 L 0 252 L 62 228 L 122 254 L 176 234 L 240 256 L 300 232 L 366 254 L 420 238 L 420 260 Z" />

        {/* ── 처마 ──
            같은 곡선을 위아래로 오프셋한 띠 4겹: 기와 → 단청(초록) → 단청(주홍) → 서까래.
            왼쪽 끝이 어긋나며 잘린 면이 처마 끝(추녀)이 된다. */}
        {/* 기와 */}
        <path
          className="roof-tile"
          d="M 39 94 C 66 108, 96 112, 134 108 C 200 100, 300 54, 420 -8
             L 420 22 C 300 84, 200 130, 134 138 C 96 142, 66 138, 49 124 Z"
        />
        {/* 기와 골(수키와) */}
        <g className="roof-tile-line">
          {EAVE_POINTS.map(([x, y]) => (
            <line key={`r${x}`} x1={x} y1={y - 30} x2={x} y2={y} />
          ))}
        </g>
        {/* 단청 — 초록 바탕 */}
        <path
          className="roof-green"
          d="M 49 124 C 66 138, 96 142, 134 138 C 200 130, 300 84, 420 22
             L 420 44 C 300 106, 200 152, 134 160 C 96 164, 66 160, 57 146 Z"
        />
        {/* 단청 — 주홍 띠 */}
        <path
          className="roof-red"
          d="M 57 146 C 66 160, 96 164, 134 160 C 200 152, 300 106, 420 44
             L 420 56 C 300 118, 200 164, 134 172 C 96 176, 66 172, 61 158 Z"
        />
        {/* 서까래 */}
        <path
          className="roof-brown"
          d="M 61 158 C 66 172, 96 176, 134 172 C 200 164, 300 118, 420 56
             L 420 68 C 300 130, 200 176, 134 184 C 96 188, 66 184, 65 170 Z"
        />
        {/* 막새(기와 끝) — 연꽃 문양 */}
        <g className="roof-mak">
          {EAVE_POINTS.map(([x, y]) => (
            <g key={`m${x}`}>
              <circle className="mak-disc" cx={x} cy={y} r="8" />
              <circle className="mak-flower" cx={x} cy={y} r="3.4" />
            </g>
          ))}
        </g>
        {/* 단청 꽃문양 — 초록 바탕 위 */}
        <g className="roof-flower">
          {EAVE_POINTS.map(([x, y]) => (
            <g key={`f${x}`}>
              <circle className="flower-petal" cx={x} cy={y + 12} r="5.6" />
              <circle className="flower-core" cx={x} cy={y + 12} r="2.3" />
            </g>
          ))}
        </g>

        {/* 풍경(風磬) — 처마 끝에 매달린 종과 물고기 */}
        <g className="sky-bell">
          <line className="bell-string" x1="100" y1="185" x2="100" y2="203" />
          <path className="bell-body" d="M 92 204 L 108 204 L 110 216 Q 100 222 90 216 Z" />
          <ellipse className="bell-body" cx="100" cy="218" rx="11" ry="2.6" />
          <line className="bell-string" x1="100" y1="221" x2="100" y2="228" />
          <g className="bell-fish">
            <path d="M 95 234 Q 101 227 110 234 Q 101 241 95 234 Z" />
            <path d="M 95 234 L 88 229 L 88 239 Z" />
          </g>
        </g>
      </svg>

      <span className="sky-time">{time} · {PHASE_LABEL[phase]}</span>
    </div>
  )
}
