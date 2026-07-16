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

// 처마 앞선(前線) 곡선 — 왼쪽 추녀 끝에서 오른쪽 위로 올라가는 2차 베지어.
const P0 = [58, 158] as const
const P1 = [158, 66] as const
const P2 = [300, 22] as const
const EAVE_D = `M ${P0[0]} ${P0[1]} Q ${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}`

function eaveAt(t: number): [number, number] {
  const u = 1 - t
  return [
    u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0],
    u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1],
  ]
}
const SAMPLE = [0.05, 0.16, 0.27, 0.38, 0.49, 0.6, 0.71, 0.82, 0.93]
const stamp = (dy: number) => SAMPLE.map((t) => { const [x, y] = eaveAt(t); return [x, y + dy] as const })

// 연화(꽃문양) 8장 꽃잎
const PETALS = Array.from({ length: 8 }, (_, i) => i * 45)

// 보딩패스 왼쪽 면의 단청 한옥 처마.
// 이미지 파일 없이 SVG로 그린 단청 — 연화머리초(서까래 끝 동심원)·연화 꽃문양·수막새가
// 처마 곡선을 따라 반복된다. 시간대(새벽/아침/낮/노을/밤)에 따라 하늘·해·달·별·단청 색조가 함께 바뀐다.
// preserveAspectRatio=meet + 뒤의 하늘 그라데이션으로, 화면이 줄어도 해·달·풍경이 잘리지 않는다.
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

      <svg className="sky-art" viewBox="0 0 300 340" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <defs>
          <filter id="hk-glow" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          {/* 연화머리초 — 서까래 끝 동심원 (단청의 핵심 반복 문양) */}
          <g id="dc-eye">
            <circle r="10" className="dc-outline" />
            <circle r="8.6" className="dc-green" />
            <circle r="6.3" className="dc-orange" />
            <circle r="4.1" className="dc-yellow" />
            <circle r="2.2" className="dc-red" />
            <circle r="0.9" className="dc-white" />
          </g>
          {/* 연화 — 꽃문양 (초록 바탕 위) */}
          <g id="dc-flower">
            <circle r="7.6" className="dc-green" />
            {PETALS.map((deg) => (
              <ellipse key={deg} cx="0" cy="-4.7" rx="1.7" ry="3.4" transform={`rotate(${deg})`} className="dc-orange" />
            ))}
            <circle r="2.5" className="dc-yellow" />
            <circle r="0.9" className="dc-white" />
          </g>
          {/* 수막새 — 기와 끝 연꽃 원판 */}
          <g id="dc-mak">
            <circle r="7.4" className="dc-tile-disc" />
            <circle r="3.3" className="dc-orange" />
            <circle r="1.3" className="dc-yellow" />
          </g>
        </defs>

        {/* 해 / 달 — 좌상단 고정 */}
        {phase === 'night' ? (
          <g>
            <circle className="orb-glow moon" cx="60" cy="60" r="40" filter="url(#hk-glow)" />
            <circle className="orb moon" cx="60" cy="60" r="28" />
            <circle className="crater" cx="72" cy="51" r="6" />
            <circle className="crater" cx="52" cy="71" r="4.5" />
            <circle className="crater" cx="49" cy="49" r="3" />
          </g>
        ) : (
          <g>
            <circle className="orb-glow sun" cx="60" cy="60" r="38" filter="url(#hk-glow)" />
            <circle className="orb sun" cx="60" cy="60" r="27" />
          </g>
        )}

        {/* 서운(상서구름) */}
        {cloudy && (
          <>
            <g transform="translate(10 118) scale(0.85)">
              <g className="cloud c1">
                <path d="M 8 22 C 8 11, 23 7, 29 16 C 36 5, 54 8, 55 20 C 66 20, 70 33, 57 35 L 14 35 C 1 35, 0 24, 8 22 Z" />
                <path className="cloud-curl" d="M 24 23 a 5 5 0 1 1 -6.5 -4.6" />
              </g>
            </g>
            <g transform="translate(120 40) scale(0.6)">
              <g className="cloud c2">
                <path d="M 8 22 C 8 11, 23 7, 29 16 C 36 5, 54 8, 55 20 C 66 20, 70 33, 57 35 L 14 35 C 1 35, 0 24, 8 22 Z" />
                <path className="cloud-curl" d="M 24 23 a 5 5 0 1 1 -6.5 -4.6" />
              </g>
            </g>
          </>
        )}

        {/* ── 단청 처마 ── (뒤에서 앞으로: 서까래 소로 → 부연/서까래 동심원 → 주홍 → 초록+꽃 → 기와+수막새) */}
        <path className="dc-band-soffit" d={EAVE_D} transform="translate(0 27)" />
        {stamp(40).map(([x, y], i) => <use key={`e2${i}`} href="#dc-eye" transform={`translate(${x} ${y}) scale(0.72)`} />)}
        {stamp(21).map(([x, y], i) => <use key={`e1${i}`} href="#dc-eye" transform={`translate(${x} ${y})`} />)}
        <path className="dc-band-red" d={EAVE_D} transform="translate(0 10)" />
        <path className="dc-band-green" d={EAVE_D} />
        {stamp(1).map(([x, y], i) => <use key={`fl${i}`} href="#dc-flower" transform={`translate(${x} ${y})`} />)}
        <path className="dc-band-tile" d={EAVE_D} transform="translate(0 -17)" />
        {stamp(-17).map(([x, y], i) => <use key={`mk${i}`} href="#dc-mak" transform={`translate(${x} ${y})`} />)}

        {/* 풍경(風磬) — 추녀 끝에서 흔들림 */}
        <g className="sky-bell">
          <line className="bell-string" x1="96" y1="176" x2="96" y2="196" />
          <path className="bell-body" d="M 88 197 L 104 197 L 106 210 Q 96 216 86 210 Z" />
          <ellipse className="bell-body" cx="96" cy="212" rx="11" ry="2.6" />
          <line className="bell-string" x1="96" y1="215" x2="96" y2="222" />
          <g className="bell-fish">
            <path d="M 91 228 Q 97 221 106 228 Q 97 235 91 228 Z" />
            <path d="M 91 228 L 84 223 L 84 233 Z" />
          </g>
        </g>

        {/* 산 — 하단 고정 */}
        <path className="dc-mtn back" d="M 0 340 L 0 300 Q 62 272 120 300 Q 182 330 244 296 Q 288 276 300 292 L 300 340 Z" />
        <path className="dc-mtn front" d="M 0 340 L 0 322 Q 74 296 140 320 Q 200 340 262 312 Q 290 300 300 314 L 300 340 Z" />
      </svg>

      <span className="sky-time">{time} · {PHASE_LABEL[phase]}</span>
    </div>
  )
}
