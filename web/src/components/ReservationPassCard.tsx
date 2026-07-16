import type { ReservationDetail, Voucher } from '../../shared/types'
import { fileUrl } from '../api'
import { fmtDateTime } from '../categories'

export default function ReservationPassCard({ reservation, vouchers = [] }: { reservation: ReservationDetail; vouchers?: Voucher[] }) {
  const at = reservation.reservedAt ? fmtDateTime(reservation.reservedAt) : null
  const voucher = reservation.voucherId ? vouchers.find((v) => v.id === reservation.voucherId) : undefined

  return (
    <div className="resv-ticket">
      <div className="resv-ticket-eyebrow">🍽 Reservation · 예약 확인</div>
      <div className="resv-ticket-main">
        {at && (
          <div className="resv-field"><span className="k">일시</span><span className="v">{at.date} {at.time}</span></div>
        )}
        {reservation.partySize != null && (
          <div className="resv-field"><span className="k">인원</span><span className="v">{reservation.partySize}명</span></div>
        )}
        {reservation.bookingRef && (
          <div className="resv-field"><span className="k">예약번호</span><span className="v">{reservation.bookingRef}</span></div>
        )}
        {reservation.bookedVia && (
          <div className="resv-field"><span className="k">예약처</span><span className="v">{reservation.bookedVia}</span></div>
        )}
        {reservation.voucherId && (
          <div className="resv-field"><span className="k">바우처</span><span className="v">
            {voucher ? (
              <a className="plain-link" href={fileUrl(voucher.filePath)} target="_blank" rel="noreferrer">🎫 {reservation.voucherTitle ?? voucher.title}</a>
            ) : `🎫 ${reservation.voucherTitle ?? '연결됨'}`}
          </span></div>
        )}
      </div>
      {reservation.note && <div className="resv-ticket-note">📝 {reservation.note}</div>}
      {reservation.confirmed && (
        <div className="stamp green small resv-ticket-stamp"><span className="stamp-text">OK</span></div>
      )}
    </div>
  )
}
