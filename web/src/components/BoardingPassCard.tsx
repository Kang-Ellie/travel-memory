import type { FlightDetail } from '../../shared/types'
import { fileUrl } from '../api'

function fmtDT(v: string | null): { time: string; date: string } {
  if (!v) return { time: '?', date: '' }
  const d = new Date(v)
  return {
    time: d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    date: d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }),
  }
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}시간${m > 0 ? ` ${m}분` : ''}` : `${m}분`
}

export default function BoardingPassCard({ flight, fromName }: { flight: FlightDetail; fromName: string }) {
  const dep = fmtDT(flight.departAt)
  const arr = fmtDT(flight.arriveAt)
  const hasInfo = flight.durationMinutes != null || flight.bookingRef || flight.flightClass
    || flight.seat || flight.bookedVia || flight.departureLocation

  return (
    <div className="boarding-pass">
      <div className="boarding-pass-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {flight.airlineLogoPath ? (
            <img src={fileUrl(flight.airlineLogoPath)} alt="" style={{ height: 22, objectFit: 'contain' }} />
          ) : (
            <span style={{ fontWeight: 800 }}>{flight.airline || '✈️ 항공사 미입력'}</span>
          )}
          {flight.flightNo && <span className="muted">{flight.flightNo}</span>}
        </div>
        {flight.gate && (
          <div style={{ textAlign: 'right' }}>
            <div className="muted" style={{ fontSize: 10, letterSpacing: '0.06em' }}>GATE</div>
            <div style={{ fontWeight: 800 }}>{flight.gate}</div>
          </div>
        )}
      </div>
      <div className="boarding-pass-route">
        <div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{fromName}</div>
          <div className="muted">{dep.date} {dep.time}</div>
        </div>
        <div style={{ fontSize: 20 }}>✈️</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{flight.destination || '?'}</div>
          <div className="muted">{arr.date} {arr.time}</div>
        </div>
      </div>
      {hasInfo && (
        <>
          <div className="boarding-pass-divider" />
          <div className="boarding-pass-info">
            {flight.durationMinutes != null && (
              <div><div className="muted" style={{ fontSize: 10 }}>소요시간</div><div style={{ fontWeight: 700 }}>{formatDuration(flight.durationMinutes)}</div></div>
            )}
            {flight.bookingRef && (
              <div><div className="muted" style={{ fontSize: 10 }}>예약번호</div><div style={{ fontWeight: 700 }}>{flight.bookingRef}</div></div>
            )}
            {flight.flightClass && (
              <div><div className="muted" style={{ fontSize: 10 }}>CLASS</div><div style={{ fontWeight: 700 }}>{flight.flightClass}</div></div>
            )}
            {flight.seat && (
              <div><div className="muted" style={{ fontSize: 10 }}>SEAT</div><div style={{ fontWeight: 700 }}>{flight.seat}</div></div>
            )}
            {flight.bookedVia && (
              <div><div className="muted" style={{ fontSize: 10 }}>예약처</div><div style={{ fontWeight: 700 }}>{flight.bookedVia}</div></div>
            )}
            {flight.departureLocation && (
              <div><div className="muted" style={{ fontSize: 10 }}>출발장소</div><div style={{ fontWeight: 700 }}>{flight.departureLocation}</div></div>
            )}
          </div>
        </>
      )}
      {(flight.confirmed || flight.voucherId) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 16px 14px' }}>
          {flight.confirmed && <span className="chip green">✅ 예약 확정</span>}
          {flight.voucherId && <span className="chip green" title={flight.voucherTitle ?? ''}>🎫 {flight.voucherTitle}</span>}
        </div>
      )}
    </div>
  )
}
