import type { Place } from '../../shared/types'
import { recommendedFieldLabel } from '../categories'

// 장소의 부가정보(영업시간·예약필요·추천메뉴·팁·장단점 등)를 한 곳에서 렌더링.
// 장소 족보 카드뿐 아니라 북마크·PLAN B·일정에서도 같은 정보가 같은 모양으로 보이게 공용화했다.
export default function PlaceMeta({ place }: { place: Place }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {(place.stayType || place.grade) && (
        <div className="muted">
          {place.stayType && <>🏨 {place.stayType} </>}
          {place.grade && <>· ⭐ {place.grade}</>}
        </div>
      )}
      {place.airportCode && <div className="muted">✈️ {place.airportCode}</div>}
      {place.hours && (
        <div className="muted">🕒 {place.hours}{place.breakTime ? ` (브레이크타임 ${place.breakTime})` : ''}</div>
      )}
      {place.reservationNeeded && <div className="muted">📌 예약 필요</div>}
      {place.recommendedMenu && <div className="muted">{recommendedFieldLabel(place.category)}: {place.recommendedMenu}</div>}
      {place.babyMenu && <div className="muted">🍼 영아 픽: {place.babyMenu}</div>}
      {place.directions && <div className="muted">🚕 {place.directions}</div>}
      {place.tip && <div className="muted">💡 {place.tip}</div>}
      {(place.valetCompany || place.bookingChannel) && (
        <div className="muted">
          {place.valetCompany && <>🚗 {place.valetCompany} </>}
          {place.bookingChannel && <>· 📞 {place.bookingChannel}</>}
        </div>
      )}
      {place.bookingUrl && (
        <div className="muted">
          🔗 <a href={place.bookingUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>예약 사이트</a>
        </div>
      )}
      {place.valetDropoffLocation && <div className="muted">🅿️ 접수장소: {place.valetDropoffLocation}</div>}
      {place.valetReturnLocation && <div className="muted">🔑 인도장소: {place.valetReturnLocation}</div>}
      {(place.pros || place.cons) && (
        <div className="muted">
          {place.pros && <>👍 {place.pros} </>}
          {place.cons && <>👎 {place.cons}</>}
        </div>
      )}
    </div>
  )
}
