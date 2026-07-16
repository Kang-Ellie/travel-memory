import type { ValetDetail, Voucher } from '../../shared/types'
import { fileUrl } from '../api'
import { fmtDateTime } from '../categories'

export default function ValetPassCard({ valet, placeName, vouchers = [] }: { valet: ValetDetail; placeName: string; vouchers?: Voucher[] }) {
  const at = fmtDateTime(valet.scheduledAt)
  const hasInfo = valet.bookingRef || valet.bookedVia
  const voucher = valet.voucherId ? vouchers.find((v) => v.id === valet.voucherId) : undefined

  return (
    <div className="bpass">
      <div className="bpass-main">
        <div className="bpass-head">
          <div className="brand"><span>🚗 {valet.company || '발렛'}</span></div>
          {valet.location && (
            <div className="gate">
              <div className="gate-label">위치</div>
              <div className="gate-val">{valet.location}</div>
            </div>
          )}
        </div>

        <div className="bpass-route">
          <div className="bpass-endpoint from">
            <div className="kicker">Valet</div>
            <div className="code">{placeName}</div>
            <div className="time">{at.date} {at.time}</div>
          </div>
          <div className="bpass-path"><span className="line" /><span className="plane">🅿</span></div>
        </div>

        {hasInfo && (
          <div className="bpass-info">
            {valet.bookingRef && <div><div className="k">예약번호</div><div className="v">{valet.bookingRef}</div></div>}
            {valet.bookedVia && <div><div className="k">예약처</div><div className="v">{valet.bookedVia}</div></div>}
          </div>
        )}

        {valet.voucherId && (
          <div className="bpass-badges">
            {voucher ? (
              <a className="chip green" href={fileUrl(voucher.filePath)} target="_blank" rel="noreferrer" title="바우처 열기">🎫 {valet.voucherTitle ?? voucher.title}</a>
            ) : (
              <span className="chip green" title={valet.voucherTitle ?? ''}>🎫 {valet.voucherTitle}</span>
            )}
          </div>
        )}
      </div>

      <div className="bpass-stub">
        <div className="stub-label">Valet</div>
        <div className="bpass-barcode" />
        <div className="stub-code">{valet.bookingRef || 'CAR'}</div>
      </div>

      {valet.confirmed && (
        <div className="stamp green small bpass-confirm"><span className="stamp-text">OK</span></div>
      )}
    </div>
  )
}
