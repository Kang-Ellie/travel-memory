import type { ValetDetail } from '../../shared/types'
import { fmtDateTime } from '../categories'

export default function ValetPassCard({ valet, placeName }: { valet: ValetDetail; placeName: string }) {
  const at = fmtDateTime(valet.scheduledAt)
  const hasInfo = valet.bookingRef || valet.bookedVia

  return (
    <div className="boarding-pass">
      <div className="boarding-pass-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 800 }}>🚗 {valet.company || '발렛'}</span>
        </div>
        {valet.location && (
          <div style={{ textAlign: 'right' }}>
            <div className="muted" style={{ fontSize: 10, letterSpacing: '0.06em' }}>위치</div>
            <div style={{ fontWeight: 800 }}>{valet.location}</div>
          </div>
        )}
      </div>
      <div className="boarding-pass-route">
        <div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{placeName}</div>
          <div className="muted">{at.date} {at.time}</div>
        </div>
      </div>
      {hasInfo && (
        <>
          <div className="boarding-pass-divider" />
          <div className="boarding-pass-info">
            {valet.bookingRef && (
              <div><div className="muted" style={{ fontSize: 10 }}>예약번호</div><div style={{ fontWeight: 700 }}>{valet.bookingRef}</div></div>
            )}
            {valet.bookedVia && (
              <div><div className="muted" style={{ fontSize: 10 }}>예약처</div><div style={{ fontWeight: 700 }}>{valet.bookedVia}</div></div>
            )}
          </div>
        </>
      )}
      {(valet.confirmed || valet.voucherId) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 16px 14px' }}>
          {valet.confirmed && <span className="chip green">✅ 예약 확정</span>}
          {valet.voucherId && <span className="chip green" title={valet.voucherTitle ?? ''}>🎫 {valet.voucherTitle}</span>}
        </div>
      )}
    </div>
  )
}
