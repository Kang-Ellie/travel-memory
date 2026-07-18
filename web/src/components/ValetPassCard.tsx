import type { Place, ValetDetail, Voucher } from '../../shared/types'
import { fileUrl } from '../api'
import { fmtDateTime } from '../categories'

export default function ValetPassCard({ valet, place, vouchers = [] }: { valet: ValetDetail; place: Place; vouchers?: Voucher[] }) {
  const at = fmtDateTime(valet.scheduledAt)
  // 접수/인도장소는 장소 족보에 등록해두면 티켓마다 다시 입력할 필요 없이 항상 같이 뜬다.
  const hasInfo = valet.bookingRef || valet.bookedVia || place.valetDropoffLocation || place.valetReturnLocation
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
            <div className="code">{place.name}</div>
            <div className="time">{at.date} {at.time}</div>
          </div>
          <div className="bpass-path"><span className="line" /><span className="plane">🅿</span></div>
        </div>

        {hasInfo && (
          <div className="bpass-info">
            {place.valetDropoffLocation && <div><div className="k">🅿️ 접수장소</div><div className="v">{place.valetDropoffLocation}</div></div>}
            {place.valetReturnLocation && <div><div className="k">🔑 인도장소</div><div className="v">{place.valetReturnLocation}</div></div>}
            {valet.bookingRef && <div><div className="k">예약번호</div><div className="v">{valet.bookingRef}</div></div>}
            {valet.bookedVia && <div><div className="k">예약처</div><div className="v">{valet.bookedVia}</div></div>}
          </div>
        )}

        {(valet.voucherId || place.bookingUrl) && (
          <div className="bpass-badges">
            {place.bookingUrl && (
              <a className="chip blue" href={place.bookingUrl} target="_blank" rel="noreferrer" title="발렛 예약 사이트로 이동" onClick={(e) => e.stopPropagation()}>🔗 예약 사이트</a>
            )}
            {voucher ? (
              <a className="chip green" href={fileUrl(voucher.filePath)} target="_blank" rel="noreferrer" title="바우처 열기" onClick={(e) => e.stopPropagation()}>🎫 {valet.voucherTitle ?? voucher.title}</a>
            ) : valet.voucherId ? (
              <span className="chip green" title={valet.voucherTitle ?? ''}>🎫 {valet.voucherTitle}</span>
            ) : null}
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
