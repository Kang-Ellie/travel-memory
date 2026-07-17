import type { FlightDetail, Member, Voucher } from '../../shared/types'
import { fileUrl } from '../api'
import { fmtDateTime } from '../categories'

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}시간${m > 0 ? ` ${m}분` : ''}` : `${m}분`
}

// 티켓 카드에서는 "인천국제공항"처럼 긴 정식 명칭 대신 "인천"처럼 짧게 보여주고,
// 코드는 이름과 같은 줄에 괄호로 욱여넣지 않고 항상 그 아래 줄에 따로 보여준다
// (같은 줄에 붙이면 카드 폭에 따라 줄바꿈 위치가 들쭉날쭉해져서 지저분해 보임).
// 장소 족보에는 정식 명칭이 그대로 남아있으니 검색·지도에서는 영향 없다.
function splitAirportLabel(rawName: string, explicitCode?: string | null): { name: string; code: string | null } {
  const stripped = rawName.replace(/(국제공항|공항)$/, '').trim() || rawName
  if (explicitCode) return { name: stripped, code: explicitCode }
  // 자유 입력 도착지에 "나리타 (NRT)"처럼 코드를 직접 적어둔 경우도 같은 방식으로 분리한다.
  const m = stripped.match(/^(.*?)\s*\(([^()]+)\)\s*$/)
  if (m) return { name: m[1].trim() || stripped, code: m[2].trim() }
  return { name: stripped, code: null }
}

export default function BoardingPassCard({ flight, fromName, fromAirportCode, participants = [], vouchers = [] }: {
  flight: FlightDetail; fromName: string; fromAirportCode?: string | null; participants?: Member[]; vouchers?: Voucher[]
}) {
  const voucher = flight.voucherId ? vouchers.find((v) => v.id === flight.voucherId) : undefined
  const dep = fmtDateTime(flight.departAt)
  const arr = fmtDateTime(flight.arriveAt)
  // 도착지를 장소로 등록해뒀으면 destination 자유 텍스트는 "To"가 아니라 보조 상세 정보로 내려간다.
  const destinationDetail = flight.destinationPlaceName ? flight.destination : null
  const hasInfo = flight.durationMinutes != null || flight.bookingRef
    || flight.seat || flight.bookedVia || flight.departureLocation || destinationDetail
  const passengerNames = flight.passengerIds
    .map((id) => participants.find((p) => p.id === id)?.name)
    .filter((n): n is string => !!n)
  const allAboard = participants.length > 0 && passengerNames.length === participants.length
  const from = splitAirportLabel(fromName, fromAirportCode)
  const toRaw = flight.destinationPlaceName ?? flight.destination
  const to = toRaw
    ? splitAirportLabel(toRaw, flight.destinationPlaceName ? flight.destinationAirportCode : null)
    : null

  return (
    <div className="bpass">
      <div className="bpass-main">
        <div className="bpass-head">
          <div className="brand">
            {flight.airlineLogoPath ? (
              <img src={fileUrl(flight.airlineLogoPath)} alt="" loading="lazy" decoding="async" />
            ) : (
              <span>✈️ {flight.airline || '항공사 미입력'}</span>
            )}
            {flight.flightNo && <span className="sub">{flight.flightNo}</span>}
          </div>
          {flight.gate && (
            <div className="gate">
              <div className="gate-label">GATE</div>
              <div className="gate-val">{flight.gate}</div>
            </div>
          )}
        </div>

        <div className="bpass-route">
          <div className="bpass-endpoint from">
            <div className="kicker">From</div>
            <div className="code" title={fromName}>{from.name}</div>
            {from.code && <div className="airport-code">{from.code}</div>}
            <div className="time">{dep.date} {dep.time}</div>
          </div>
          <div className="bpass-path"><span className="line" /><span className="plane">✈</span><span className="line" /></div>
          <div className="bpass-endpoint to">
            <div className="kicker">To</div>
            <div className="code" title={toRaw ?? undefined}>{to ? to.name : '?'}</div>
            {to?.code && <div className="airport-code">{to.code}</div>}
            <div className="time">{arr.date} {arr.time}</div>
          </div>
        </div>

        {hasInfo && (
          <div className="bpass-info">
            {flight.departureLocation && <div><div className="k">출발지 상세</div><div className="v">{flight.departureLocation}</div></div>}
            {destinationDetail && <div><div className="k">도착지 상세</div><div className="v">{destinationDetail}</div></div>}
            {flight.durationMinutes != null && <div><div className="k">소요시간</div><div className="v">{formatDuration(flight.durationMinutes)}</div></div>}
            {flight.bookingRef && <div><div className="k">예약번호</div><div className="v">{flight.bookingRef}</div></div>}
            {flight.seat && <div><div className="k">Seat</div><div className="v">{flight.seat}</div></div>}
            {flight.bookedVia && <div><div className="k">예약처</div><div className="v">{flight.bookedVia}</div></div>}
          </div>
        )}

        {(flight.voucherId || (!allAboard && passengerNames.length > 0)) && (
          <div className="bpass-badges">
            {flight.voucherId && (voucher ? (
              <a className="chip green" href={fileUrl(voucher.filePath)} target="_blank" rel="noreferrer" title="바우처 열기" onClick={(e) => e.stopPropagation()}>🎫 {flight.voucherTitle ?? voucher.title}</a>
            ) : (
              <span className="chip green" title={flight.voucherTitle ?? ''}>🎫 {flight.voucherTitle}</span>
            ))}
            {!allAboard && passengerNames.length > 0 && (
              <span className="chip purple">🧑‍🤝‍🧑 {passengerNames.join(', ')}</span>
            )}
          </div>
        )}
      </div>

      <div className="bpass-stub">
        <div className="stub-label">Boarding</div>
        <div className="bpass-barcode" />
        <div className="stub-code">{flight.bookingRef || flight.flightNo || 'TKT'}</div>
      </div>

      {flight.confirmed && (
        <div className="stamp green small bpass-confirm"><span className="stamp-text">OK</span></div>
      )}
    </div>
  )
}
