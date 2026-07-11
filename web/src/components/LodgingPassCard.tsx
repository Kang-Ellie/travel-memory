import type { LodgingDetail } from '../../shared/types'
import { fmtDateTime } from '../categories'

export default function LodgingPassCard({ lodging, placeName }: { lodging: LodgingDetail; placeName: string }) {
  const inAt = fmtDateTime(lodging.checkInAt)
  const outAt = fmtDateTime(lodging.checkOutAt)
  const hasInfo = lodging.bookingRef || lodging.bookedVia

  return (
    <div className="boarding-pass">
      <div className="boarding-pass-head">
        <span style={{ fontWeight: 800 }}>🏨 {placeName}</span>
      </div>
      <div className="boarding-pass-route">
        <div>
          <div className="muted" style={{ fontSize: 10 }}>체크인</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{inAt.date} {inAt.time}</div>
        </div>
        <div style={{ fontSize: 20 }}>🛏</div>
        <div style={{ textAlign: 'right' }}>
          <div className="muted" style={{ fontSize: 10 }}>체크아웃</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{outAt.date} {outAt.time}</div>
        </div>
      </div>
      {hasInfo && (
        <>
          <div className="boarding-pass-divider" />
          <div className="boarding-pass-info">
            {lodging.bookingRef && (
              <div><div className="muted" style={{ fontSize: 10 }}>예약번호</div><div style={{ fontWeight: 700 }}>{lodging.bookingRef}</div></div>
            )}
            {lodging.bookedVia && (
              <div><div className="muted" style={{ fontSize: 10 }}>예약처</div><div style={{ fontWeight: 700 }}>{lodging.bookedVia}</div></div>
            )}
          </div>
        </>
      )}
      {(lodging.confirmed || lodging.voucherId) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 16px 14px' }}>
          {lodging.confirmed && <span className="chip green">✅ 예약 확정</span>}
          {lodging.voucherId && <span className="chip green" title={lodging.voucherTitle ?? ''}>🎫 {lodging.voucherTitle}</span>}
        </div>
      )}
    </div>
  )
}
