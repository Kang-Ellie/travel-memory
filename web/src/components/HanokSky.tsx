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

// 정면에서 본 기와지붕 — 가운데는 낮고 양끝 처마가 살짝 치켜올라간 곡선.
const ROOF_L = 54
const ROOF_R = 246
const ROOF_CX = 150
const topY = (x: number) => 214 + 0.00072 * (x - ROOF_CX) ** 2   // 지붕 윗선(용마루 아래)
const botY = (x: number) => 250 - 0.00092 * (x - ROOF_CX) ** 2   // 처마 밑선

// 지붕 실루엣 (윗선 왼→오, 밑선 오→왼)
const STEP = (ROOF_R - ROOF_L) / 16
const XS = Array.from({ length: 17 }, (_, i) => ROOF_L + i * STEP)
const ROOF_PATH = [
  `M ${ROOF_L} ${botY(ROOF_L).toFixed(1)}`,
  ...XS.map((x) => `L ${x.toFixed(1)} ${topY(x).toFixed(1)}`),
  ...[...XS].reverse().map((x) => `L ${x.toFixed(1)} ${botY(x).toFixed(1)}`),
  'Z',
].join(' ')

// 기왓골(세로 줄무늬)·수막새(처마 끝 원판) 위치
const TILE_XS = Array.from({ length: 15 }, (_, i) => ROOF_L + 8 + i * ((ROOF_R - ROOF_L - 16) / 14))

// 대문 널판 x좌표
const DOOR_L = 116
const DOOR_R = 184
const PLANK_XS = Array.from({ length: 5 }, (_, i) => DOOR_L + 4 + i * ((DOOR_R - DOOR_L - 8) / 4))

// 보딩패스 왼쪽 면의 한옥 씬 — 첨부한 플랫 벡터 스타일(정면 기와지붕 + 대문 + 기와담).
// 이미지 파일 없이 SVG. 시간대(새벽/아침/낮/노을/밤)에 따라 하늘·해·달·별·구름이 바뀐다.
// preserveAspectRatio=meet + 뒤의 하늘 그라데이션으로, 화면이 줄어도 잘리지 않는다.
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
  const bird = phase === 'morning' || phase === 'day' || phase === 'dusk'

  return (
    <div className={`sky ${phase} ${photo ? 'has-photo' : ''}`}>
      {photo && <img className="sky-photo" src={photo} alt="" />}
      <div className="sky-grad" />
      {starry && <div className="sky-stars" />}

      {/* 기와담 — 화면 전체 폭으로 바닥에 깔린다 (가운데 대문과 별개 층) */}
      <div className="sky-ground">
        <div className="sky-ground-cap" />
      </div>

      {/* 나뭇가지 — 화면 왼쪽 끝에서 뻗어나온다 (넓어질수록 길어짐) */}
      <svg className="sky-branch-layer" viewBox="0 0 170 130" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
        <path className="hk-branch" d="M -4 40 C 40 38, 78 46, 120 30 M 66 41 C 72 26, 84 19, 98 18 M 96 36 C 104 25, 116 21, 130 22" />
        <g className="hk-leaf">
          <ellipse cx="99" cy="17" rx="6" ry="3" transform="rotate(-32 99 17)" />
          <ellipse cx="131" cy="22" rx="6" ry="3" transform="rotate(-10 131 22)" />
          <ellipse cx="122" cy="29" rx="6" ry="3" transform="rotate(-16 122 29)" />
          <ellipse cx="118" cy="31" rx="5.4" ry="2.7" transform="rotate(6 118 31)" />
        </g>
      </svg>

      <svg className="sky-art" viewBox="0 0 300 340" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <defs>
          <filter id="hk-glow" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        {/* 해 / 달 */}
        {phase === 'night' ? (
          <g>
            <circle className="orb-glow moon" cx="206" cy="74" r="40" filter="url(#hk-glow)" />
            <circle className="orb moon" cx="206" cy="74" r="30" />
            <circle className="crater" cx="218" cy="65" r="6" />
            <circle className="crater" cx="197" cy="86" r="4.6" />
            <circle className="crater" cx="195" cy="63" r="3" />
          </g>
        ) : (
          <g>
            <circle className="orb-glow sun" cx="206" cy="76" r="40" filter="url(#hk-glow)" />
            <circle className="orb sun" cx="206" cy="76" r="30" />
          </g>
        )}

        {/* 학 — 낮에 해 곁을 지나감 */}
        {bird && (
          <g className="sky-bird">
            <path className="hk-bird" d="M 232 96 q 7 -8 14 -3 q -6 1 -8 6 q 8 -3 13 1 q -7 1 -10 6 q -6 -5 -9 -6 q -3 1 -7 -1 q 8 -3 14 -4 z" />
          </g>
        )}

        {/* 서운(상서구름) */}
        {cloudy && (
          <>
            <g transform="translate(24 44) scale(0.8)">
              <g className="cloud c1">
                <path d="M 8 22 C 8 11, 23 7, 29 16 C 36 5, 54 8, 55 20 C 66 20, 70 33, 57 35 L 14 35 C 1 35, 0 24, 8 22 Z" />
                <path className="cloud-curl" d="M 24 23 a 5 5 0 1 1 -6.5 -4.6" />
              </g>
            </g>
            <g transform="translate(190 150) scale(0.62)">
              <g className="cloud c2">
                <path d="M 8 22 C 8 11, 23 7, 29 16 C 36 5, 54 8, 55 20 C 66 20, 70 33, 57 35 L 14 35 C 1 35, 0 24, 8 22 Z" />
                <path className="cloud-curl" d="M 24 23 a 5 5 0 1 1 -6.5 -4.6" />
              </g>
            </g>
          </>
        )}

        {/* ── 대문 ── */}
        {/* 좌우 벽(회벽) */}
        <rect className="hk-plaster" x="84" y="266" width="34" height="70" />
        <rect className="hk-plaster" x="182" y="266" width="34" height="70" />
        {/* 대문 널판 */}
        <rect className="hk-door" x={DOOR_L} y="262" width={DOOR_R - DOOR_L} height="74" />
        {PLANK_XS.map((x) => (
          <line key={`p${x}`} className="hk-doorline" x1={x} y1="264" x2={x} y2="336" />
        ))}
        {/* 문고리 */}
        <circle className="hk-stud" cx="141" cy="292" r="3.4" />
        <circle className="hk-stud" cx="159" cy="292" r="3.4" />
        {/* 인방(창방) — 지붕과 문 사이 나무 보 + 단청 힌트(초록·주홍 얇은 띠) */}
        <rect className="hk-beam" x="80" y="252" width="140" height="12" />
        <rect className="hk-dc-green" x="80" y="254" width="140" height="2.4" />
        <rect className="hk-dc-red" x="80" y="259.5" width="140" height="2.4" />

        {/* ── 기와지붕 ── */}
        <path className="hk-roof" d={ROOF_PATH} />
        {/* 기왓골 */}
        {TILE_XS.map((x) => (
          <line key={`t${x}`} className="hk-tileline" x1={x} y1={topY(x) + 2} x2={x} y2={botY(x) - 1} />
        ))}
        {/* 수막새(처마 끝 원판) */}
        {TILE_XS.map((x) => (
          <circle key={`m${x}`} className="hk-tileend" cx={x} cy={botY(x)} r="3.6" />
        ))}
        {/* 용마루 + 양끝 치미(장식) */}
        <rect className="hk-ridge" x="100" y="208" width="100" height="8" rx="4" />
        <path className="hk-ridge" d="M 100 212 q -8 -2 -10 -10 q 8 3 12 8 z" />
        <path className="hk-ridge" d="M 200 212 q 8 -2 10 -10 q -8 3 -12 8 z" />

        {/* 풍경(風磬) — 왼쪽 처마 끝에서 흔들림 */}
        <g className="sky-bell">
          <line className="bell-string" x1="62" y1="244" x2="62" y2="258" />
          <path className="bell-body" d="M 55 259 L 69 259 L 71 270 Q 62 275 53 270 Z" />
          <ellipse className="bell-body" cx="62" cy="272" rx="9.5" ry="2.3" />
          <line className="bell-string" x1="62" y1="274" x2="62" y2="280" />
          <g className="bell-fish">
            <path d="M 57 285 Q 62 279 70 285 Q 62 291 57 285 Z" />
            <path d="M 57 285 L 51 281 L 51 289 Z" />
          </g>
        </g>
      </svg>

      <span className="sky-time">{time} · {PHASE_LABEL[phase]}</span>
    </div>
  )
}
