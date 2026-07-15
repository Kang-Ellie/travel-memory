import type { Trip } from '../../shared/types'
import { fmtMoney } from '../settlement'
import { tripCitiesLabel } from '../categories'
import { fmtRange, dday, tripStatus } from './TripsScreen'

// 여행 카드의 공용 "티켓 스텁" — 절취선 아래 반쪽에 D-day(또는 VISITED 스탬프)와 바코드.
// 대시보드와 여행 탭이 같은 모양을 쓴다.
export default function TripTicket({
  trip, onOpen, onDelete,
}: { trip: Trip; onOpen: () => void; onDelete?: () => void }) {
  const status = tripStatus(trip)
  const eyebrow = status === 'ongoing' ? 'NOW TRAVELING' : status === 'past' ? 'TRIP RECORD' : 'BOARDING PASS'
  return (
    <div className={`trip-ticket ${status}`}>
      <div className="trip-ticket-main">
        <div className="trip-ticket-eyebrow">
          <span>✈ {eyebrow}</span>
          {onDelete && (
            <button className="x-btn" style={{ marginLeft: 'auto' }} title="여행 삭제" onClick={onDelete}>×</button>
          )}
        </div>
        <h3 style={{ margin: '6px 0 4px', fontSize: 19 }}>{trip.title}</h3>
        <div style={{ fontWeight: 700 }}>{fmtRange(trip)}</div>
        {trip.cities.length > 0 && <div className="muted" style={{ marginTop: 4 }}>{tripCitiesLabel(trip)}</div>}
        {trip.budget > 0 && <div className="muted" style={{ marginTop: 4 }}>💰 예산 {fmtMoney(trip.budget, 'KRW')}</div>}
      </div>
      <div className="trip-ticket-stub">
        {status === 'past' ? (
          <span className="stamp small green"><span className="stamp-text">VISITED</span></span>
        ) : (
          <span className="trip-ticket-dday">{dday(trip)}</span>
        )}
        <div className="trip-ticket-barcode" />
        <button className="open-link" onClick={onOpen}>OPEN →</button>
      </div>
    </div>
  )
}
