import { useState } from 'react'
import type { Place, GooglePlaceResult, Country, City } from '../../shared/types'
import { STAY_TYPES } from '../../shared/types'
import { api } from '../api'
import { useQueryClient, queryKeys } from '../queries'
import {
  flagEmoji, recommendedFieldLabel,
  EDIT_CATEGORIES, NO_REVIEW_CATEGORIES, BUSINESS_INFO_CATEGORIES, BABY_MENU_CATEGORIES, RECOMMEND_CATEGORIES,
} from '../categories'
import { toast } from '../toast'
import Modal from './Modal'
import Select from './Select'

// 장소 족보 카드(PlacesScreen)에서 쓰던 수정 폼을 그대로 뽑아낸 것 — 여행 안 티켓(숙소 등)에서
// "방문 기록" 모달을 열었을 때도 같은 수정 폼을 재사용할 수 있게 컴포넌트로 독립시켰다.
export default function PlaceEditModal({
  place, countries, cities, onClose, onSaved,
}: {
  place: Place; countries: Country[]; cities: City[]; onClose: () => void; onSaved?: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(place.name)
  const [address, setAddress] = useState(place.address)
  const [category, setCategory] = useState(place.category)
  const [memo, setMemo] = useState(place.memo ?? '')
  const [mapUrl, setMapUrl] = useState(place.mapUrl ?? '')
  const [lat, setLat] = useState(place.lat)
  const [lng, setLng] = useState(place.lng)
  const [googleResults, setGoogleResults] = useState<GooglePlaceResult[]>([])
  const [googleSearching, setGoogleSearching] = useState(false)
  const [googleSearchError, setGoogleSearchError] = useState('')
  const [rating, setRating] = useState(place.rating != null ? String(place.rating) : '')
  const [pros, setPros] = useState(place.pros ?? '')
  const [cons, setCons] = useState(place.cons ?? '')
  const [countryId, setCountryId] = useState(place.countryId ?? '')
  const [cityId, setCityId] = useState(place.cityId ?? '')
  const [hours, setHours] = useState(place.hours ?? '')
  const [reservationNeeded, setReservationNeeded] = useState(place.reservationNeeded)
  const [recommendedMenu, setRecommendedMenu] = useState(place.recommendedMenu ?? '')
  const [breakTime, setBreakTime] = useState(place.breakTime ?? '')
  const [valetCompany, setValetCompany] = useState(place.valetCompany ?? '')
  const [bookingChannel, setBookingChannel] = useState(place.bookingChannel ?? '')
  const [grade, setGrade] = useState(place.grade ?? '')
  const [stayType, setStayType] = useState(place.stayType ?? '')
  const [airportCode, setAirportCode] = useState(place.airportCode ?? '')
  const [bookingUrl, setBookingUrl] = useState(place.bookingUrl ?? '')
  const [valetDropoffLocation, setValetDropoffLocation] = useState(place.valetDropoffLocation ?? '')
  const [valetReturnLocation, setValetReturnLocation] = useState(place.valetReturnLocation ?? '')
  const [checkInTime, setCheckInTime] = useState(place.checkInTime ?? '')
  const [checkOutTime, setCheckOutTime] = useState(place.checkOutTime ?? '')
  const [directions, setDirections] = useState(place.directions ?? '')
  const [babyMenu, setBabyMenu] = useState(place.babyMenu ?? '')
  const [recommend, setRecommend] = useState<boolean | null>(place.recommend)
  const [tip, setTip] = useState(place.tip ?? '')
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')
  const [showDetail, setShowDetail] = useState(false)

  const citiesOfCountry = cities.filter((c) => c.countryId === countryId)
  const isValet = category === '발렛'
  const isLodging = category === '숙소'
  const isAirport = category === '공항'
  const needsReview = !NO_REVIEW_CATEGORIES.includes(category)

  const resolveMapLink = async () => {
    if (!mapUrl.trim()) return
    setResolving(true); setResolveError('')
    const res = await api.places.resolveMapLink(mapUrl.trim())
    setResolving(false)
    if ('error' in res) { setResolveError(res.error); return }
    if (res.address) setAddress(res.address)
    if (res.name && !name.trim()) setName(res.name)
    if (res.lat != null) setLat(res.lat)
    if (res.lng != null) setLng(res.lng)
  }

  const searchGoogle = async () => {
    if (!name.trim()) return
    setGoogleSearching(true); setGoogleSearchError(''); setGoogleResults([])
    const res = await api.places.googleSearch(`${name.trim()} ${address.trim()}`.trim())
    setGoogleSearching(false)
    if ('error' in res) { setGoogleSearchError(res.error); return }
    if (res.length === 0) { setGoogleSearchError('검색 결과가 없어요.'); return }
    setGoogleResults(res)
  }
  const applyGoogleResult = (r: GooglePlaceResult) => {
    setAddress(r.address)
    setLat(r.lat)
    setLng(r.lng)
    setMapUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${r.address}`)}`)
    setGoogleResults([])
  }

  const save = async () => {
    const r = rating.trim() === '' ? null : Number(rating)
    await api.places.update(place.id, {
      name, address, category, memo: memo.trim() || null, mapUrl: mapUrl.trim() || null,
      lat, lng,
      rating: r != null && !Number.isNaN(r) ? r : null,
      pros: pros.trim() || null, cons: cons.trim() || null,
      countryId: countryId || null, cityId: cityId || null,
      hours: hours.trim() || null, reservationNeeded, recommendedMenu: recommendedMenu.trim() || null,
      breakTime: breakTime.trim() || null,
      valetCompany: valetCompany.trim() || null, bookingChannel: bookingChannel.trim() || null,
      grade: grade.trim() || null, stayType: stayType || null, airportCode: airportCode.trim() || null,
      bookingUrl: bookingUrl.trim() || null,
      valetDropoffLocation: valetDropoffLocation.trim() || null, valetReturnLocation: valetReturnLocation.trim() || null,
      checkInTime: checkInTime.trim() || null, checkOutTime: checkOutTime.trim() || null,
      directions: directions.trim() || null,
      babyMenu: babyMenu.trim() || null, recommend, tip: tip.trim() || null,
    })
    queryClient.invalidateQueries({ queryKey: queryKeys.places })
    toast.success('저장됐어요.')
    onSaved?.()
    onClose()
  }

  return (
    <Modal title={`${place.name} 수정`} onClose={onClose}>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', border: 'none', padding: 0, margin: 0 }}>
        <div className="field"><label>이름</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field grow">
          <label>주소</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" value={address} style={{ flex: 1, minWidth: 0 }} onChange={(e) => setAddress(e.target.value)} />
            <button type="button" className="btn small" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={searchGoogle} disabled={googleSearching || !name.trim()}>
              {googleSearching ? '찾는 중…' : '🔍 이름으로 찾기'}
            </button>
          </div>
        </div>
        <div className="field"><label>분류</label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {EDIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select></div>
        <div className="field grow"><label>구글 지도 링크</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" value={mapUrl} placeholder="https://maps.app.goo.gl/..." style={{ flex: 1 }}
              onChange={(e) => setMapUrl(e.target.value)} />
            <button type="button" className="btn small" onClick={resolveMapLink} disabled={resolving || !mapUrl.trim()}>
              {resolving ? '가져오는 중…' : '📍 주소 가져오기'}
            </button>
          </div>
          {resolveError && <div className="error-text" style={{ marginTop: 4 }}>{resolveError}</div>}
        </div>
        <div className="field"><label>국가 (선택)</label>
          <Select value={countryId} onChange={(e) => { setCountryId(e.target.value); setCityId('') }}>
            <option value="">— 선택 안함 —</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{flagEmoji(c.code)} {c.name}</option>)}
          </Select></div>
        {countryId && (
          <div className="field"><label>도시 (선택)</label>
            <Select value={cityId} onChange={(e) => setCityId(e.target.value)}>
              <option value="">— 선택 안함 —</option>
              {citiesOfCountry.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select></div>
        )}
      </div>

      {googleSearchError && <div className="error-text" style={{ marginTop: 8 }}>{googleSearchError}</div>}
      {googleResults.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {googleResults.map((r, i) => (
            <div key={i} className="row" style={{ alignItems: 'center' }}>
              <span className="chip green">{r.category}</span>
              <div className="grow">
                <div style={{ fontWeight: 800 }}>
                  {r.name}{r.googleRating != null && <span className="muted"> · 구글 ★{r.googleRating}</span>}
                </div>
                <div className="muted">{r.address}</div>
              </div>
              <button type="button" className="btn small primary" onClick={() => applyGoogleResult(r)}>이 주소 쓰기</button>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="btn small ghost" style={{ marginTop: 12 }} onClick={() => setShowDetail((v) => !v)}>
        {showDetail ? '▲ 간단히' : '▼ 자세히 (평점·운영정보·메모·팁 등)'}
      </button>

      {showDetail && (
        <>
          <div className="ticket-stub-divider" />
          <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', border: 'none', padding: 0, margin: 0 }}>
            {needsReview && (
              <div className="field" style={{ maxWidth: 110 }}><label>평점 (0~5, .5 단위)</label>
                <input type="number" value={rating} min={0} max={5} step={0.5} placeholder="4.5" onChange={(e) => setRating(e.target.value)} /></div>
            )}
            {isValet && (
              <>
                <div className="field grow"><label>🚗 발렛사</label>
                  <input type="text" value={valetCompany} placeholder="예: 투루발렛" onChange={(e) => setValetCompany(e.target.value)} /></div>
                <div className="field grow"><label>📞 예약 채널</label>
                  <input type="text" value={bookingChannel} placeholder="예: 카카오톡 채널, 010-1234-5678"
                    onChange={(e) => setBookingChannel(e.target.value)} /></div>
                <div className="field grow"><label>🔗 예약 사이트</label>
                  <input type="text" value={bookingUrl} placeholder="https://..." onChange={(e) => setBookingUrl(e.target.value)} /></div>
                <div className="field grow"><label>🅿️ 접수장소 (차 맡기는 곳)</label>
                  <input type="text" value={valetDropoffLocation} placeholder="예: 인천공항 T1 단기주차장 B1층 A구역15"
                    onChange={(e) => setValetDropoffLocation(e.target.value)} /></div>
                <div className="field grow"><label>🔑 인도장소 (차 찾는 곳)</label>
                  <input type="text" value={valetReturnLocation} placeholder="예: 지하3층 A32구역 정산소"
                    onChange={(e) => setValetReturnLocation(e.target.value)} /></div>
              </>
            )}
            {isLodging && (
              <>
                <div className="field"><label>🏨 숙소 유형</label>
                  <Select value={stayType} onChange={(e) => setStayType(e.target.value)} placeholder="— 선택 안 함 —">
                    {STAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select></div>
                <div className="field"><label>⭐ 성급</label>
                  <input type="text" value={grade} placeholder="예: 4성급" onChange={(e) => setGrade(e.target.value)} /></div>
                <div className="field" style={{ maxWidth: 110 }}><label>🕒 체크인 시간</label>
                  <input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} /></div>
                <div className="field" style={{ maxWidth: 110 }}><label>🕒 체크아웃 시간</label>
                  <input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} /></div>
                <div className="field grow"><label>🚕 가는 법</label>
                  <input type="text" value={directions} placeholder="예: 공항에서 리무진 버스 40분" onChange={(e) => setDirections(e.target.value)} /></div>
              </>
            )}
            {isAirport && (
              <div className="field" style={{ maxWidth: 130 }}><label>✈️ 공항 코드</label>
                <input type="text" value={airportCode} placeholder="예: ICN" maxLength={4}
                  onChange={(e) => setAirportCode(e.target.value.toUpperCase())} /></div>
            )}
            {BUSINESS_INFO_CATEGORIES.includes(category) && (
              <>
                <div className="field"><label>🕒 영업시간</label>
                  <input type="text" value={hours} placeholder="예: 매일 10:30~20:00" onChange={(e) => setHours(e.target.value)} /></div>
                <div className="field"><label>⏸ 브레이크타임</label>
                  <input type="text" value={breakTime} placeholder="예: 15:00~17:00" onChange={(e) => setBreakTime(e.target.value)} /></div>
                <div className="field" style={{ justifyContent: 'flex-end' }}>
                  <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontWeight: 700 }}>
                    <input type="checkbox" checked={reservationNeeded} onChange={(e) => setReservationNeeded(e.target.checked)} /> 예약 필요
                  </label>
                </div>
                <div className="field grow"><label>{recommendedFieldLabel(category)}</label>
                  <input type="text" value={recommendedMenu} placeholder="예: 명란 정식" onChange={(e) => setRecommendedMenu(e.target.value)} /></div>
                {BABY_MENU_CATEGORIES.includes(category) && (
                  <div className="field grow"><label>🍼 영아 픽 메뉴</label>
                    <input type="text" value={babyMenu} placeholder="예: 아기 죽, 이유식 데움 가능" onChange={(e) => setBabyMenu(e.target.value)} /></div>
                )}
              </>
            )}
            {RECOMMEND_CATEGORIES.includes(category) && (
              <div className="field"><label>추천? 비추천?</label>
                <Select value={recommend === true ? 'yes' : recommend === false ? 'no' : ''}
                  onChange={(e) => setRecommend(e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null)}>
                  <option value="">— 미정 —</option>
                  <option value="yes">👍 추천</option>
                  <option value="no">👎 비추천</option>
                </Select></div>
            )}
            <div className="field grow"><label>메모</label>
              <input type="text" value={memo} placeholder="우리끼리 메모" onChange={(e) => setMemo(e.target.value)} /></div>
            <div className="field grow"><label>💡 알아두면 좋은 팁</label>
              <input type="text" value={tip} placeholder="예: 현금 결제만 가능, 2터미널 이용" onChange={(e) => setTip(e.target.value)} /></div>
            {needsReview && (
              <>
                <div className="field grow"><label>👍 장점</label>
                  <input type="text" value={pros} placeholder="예: 조식 맛있음, 역에서 가까움" onChange={(e) => setPros(e.target.value)} /></div>
                <div className="field grow"><label>👎 단점</label>
                  <input type="text" value={cons} placeholder="예: 방음이 약함" onChange={(e) => setCons(e.target.value)} /></div>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ marginTop: 12 }}>
        <button className="btn small primary" onClick={save}>저장</button>
        <button className="btn small" onClick={onClose} style={{ marginLeft: 6 }}>취소</button>
      </div>
    </Modal>
  )
}
