import type { FlightDetail, Member, Voucher } from '../../shared/types'
import { fileUrl } from '../api'
import { fmtDateTime } from '../categories'

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}시간${m > 0 ? ` ${m}분` : ''}` : `${m}분`
}

export default function BoardingPassCard({ flight, fromName, participants = [], vouchers = [] }: {
  flight: FlightDetail; fromName: string; participants?: Member[]; vouchers?: Voucher[]
}) {
  const voucher = flight.voucherId ? vouchers.find((v) => v.id === flight.voucherId) : undefined
  const dep = fmtDateTime(flight.departAt)
  const arr = fmtDateTime(flight.arriveAt)
  const hasInfo = flight.durationMinutes != null || flight.bookingRef
    || flight.seat || flight.bookedVia || flight.departureLocation
  const passengerNames = flight.passengerIds
    .map((id) => participants.find((p) => p.id === id)?.name)
    .filter((n): n is string => !!n)
  const allAboard = participants.length > 0 && passengerNames.length === participants.length

  return (
    <div className="bpass">
      <div className="bpass-main">
        <div className="bpass-head">
          <div className="brand">
            {flight.airlineLogoPath ? (
              <img src={fileUrl(flight.airlineLogoPath)} alt="" />
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
            <div className="code" title={fromName}>{fromName}</div>
            <div className="time">{dep.date} {dep.time}</div>
          </div>
          <div className="bpass-path"><span className="line" /><span className="plane">✈</span><span className="line" /></div>
          <div className="bpass-endpoint to">
            <div className="kicker">To</div>
            <div className="code">{flight.destination || '?'}</div>
            <div className="time">{arr.date} {arr.time}</div>
          </div>
        </div>

        {hasInfo && (
          <div className="bpass-info">
            {flight.departureLocation && <div><div className="k">출발장소</div><div className="v">{flight.departureLocation}</div></div>}
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
