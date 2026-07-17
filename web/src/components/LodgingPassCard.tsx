import type { LodgingDetail, Place, Voucher } from '../../shared/types'
import { fileUrl } from '../api'
import { fmtDateTime } from '../categories'

export default function LodgingPassCard({ lodging, place, vouchers = [] }: { lodging: LodgingDetail; place: Place; vouchers?: Voucher[] }) {
  const inAt = fmtDateTime(lodging.checkInAt)
  const outAt = fmtDateTime(lodging.checkOutAt)
  const hasInfo = lodging.bookingRef || lodging.bookedVia || lodging.roomType || place.grade
  const voucher = lodging.voucherId ? vouchers.find((v) => v.id === lodging.voucherId) : undefined

  return (
    <div className="bpass">
      <div className="bpass-main">
        <div className="bpass-head">
          <div className="brand"><span title={place.name}>🏨 {place.name}</span></div>
          <div className="gate">
            <div className="gate-label">Stay</div>
            <div className="gate-val">{place.stayType || '숙소'}</div>
          </div>
        </div>

        <div className="bpass-route">
          <div className="bpass-endpoint from">
            <div className="kicker">Check-in</div>
            <div className="code">{inAt.date}</div>
            <div className="time">{inAt.time}</div>
          </div>
          <div className="bpass-path"><span className="line" /><span className="plane">🛏</span><span className="line" /></div>
          <div className="bpass-endpoint to">
            <div className="kicker">Check-out</div>
            <div className="code">{outAt.date}</div>
            <div className="time">{outAt.time}</div>
          </div>
        </div>

        {hasInfo && (
          <div className="bpass-info">
            {place.grade && <div><div className="k">성급</div><div className="v">⭐ {place.grade}</div></div>}
            {lodging.roomType && <div><div className="k">룸 타입</div><div className="v">{lodging.roomType}</div></div>}
            {lodging.bookingRef && <div><div className="k">예약번호</div><div className="v">{lodging.bookingRef}</div></div>}
            {lodging.bookedVia && <div><div className="k">예약처</div><div className="v">{lodging.bookedVia}</div></div>}
          </div>
        )}

        {(lodging.voucherId || lodging.breakfastIncluded) && (
          <div className="bpass-badges">
            {lodging.breakfastIncluded && <span className="chip yellow">🍳 조식 포함</span>}
            {lodging.voucherId && (voucher ? (
              <a className="chip green" href={fileUrl(voucher.filePath)} target="_blank" rel="noreferrer" title="바우처 열기" onClick={(e) => e.stopPropagation()}>🎫 {lodging.voucherTitle ?? voucher.title}</a>
            ) : (
              <span className="chip green" title={lodging.voucherTitle ?? ''}>🎫 {lodging.voucherTitle}</span>
            ))}
          </div>
        )}
      </div>

      <div className="bpass-stub">
        <div className="stub-label">Room Key</div>
        <div className="bpass-barcode" />
        <div className="stub-code">{lodging.bookingRef || 'STAY'}</div>
      </div>

      {lodging.confirmed && (
        <div className="stamp green small bpass-confirm"><span className="stamp-text">OK</span></div>
      )}
    </div>
  )
}
