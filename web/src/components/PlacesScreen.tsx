import { useEffect, useState } from 'react'
import type { Place, GooglePlaceResult, Country, City, BucketItem } from '../../shared/types'
import { api, fileUrl } from '../api'
import { flagEmoji, ratingColor } from '../categories'
import Window from './Window'
import Modal from './Modal'
import Select from './Select'
import PlaceDetailPanel from './PlaceDetailPanel'
import DropdownMenu from './DropdownMenu'

const CATEGORIES = ['전체', '맛집', '카페', '명소', '쇼핑', '숙소', '공항', '발렛', '기타']
const EDIT_CATEGORIES = CATEGORIES.slice(1)
const BABY_MENU_CATEGORIES = ['맛집', '카페', '숙소']
const RECOMMEND_CATEGORIES = ['맛집', '카페', '명소', '쇼핑', '숙소']

function PlaceCard({
  place, countries, cities, linkedBucketItems, onChanged,
}: {
  place: Place; countries: Country[]; cities: City[]; linkedBucketItems: BucketItem[]
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [name, setName] = useState(place.name)
  const [address, setAddress] = useState(place.address)
  const [category, setCategory] = useState(place.category)
  const [memo, setMemo] = useState(place.memo ?? '')
  const [mapUrl, setMapUrl] = useState(place.mapUrl ?? '')
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
  const [directions, setDirections] = useState(place.directions ?? '')
  const [babyMenu, setBabyMenu] = useState(place.babyMenu ?? '')
  const [recommend, setRecommend] = useState<boolean | null>(place.recommend)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')

  const citiesOfCountry = cities.filter((c) => c.countryId === countryId)
  const isValet = category === '발렛'
  const isLodging = category === '숙소'

  const resolveMapLink = async () => {
    if (!mapUrl.trim()) return
    setResolving(true); setResolveError('')
    const res = await api.places.resolveMapLink(mapUrl.trim())
    setResolving(false)
    if ('error' in res) { setResolveError(res.error); return }
    if (res.address) setAddress(res.address)
    if (res.name && !name.trim()) setName(res.name)
  }

  const save = async () => {
    const r = rating.trim() === '' ? null : Number(rating)
    await api.places.update(place.id, {
      name, address, category, memo: memo.trim() || null, mapUrl: mapUrl.trim() || null,
      rating: r != null && !Number.isNaN(r) ? r : null,
      pros: pros.trim() || null, cons: cons.trim() || null,
      countryId: countryId || null, cityId: cityId || null,
      hours: hours.trim() || null, reservationNeeded, recommendedMenu: recommendedMenu.trim() || null,
      breakTime: breakTime.trim() || null,
      valetCompany: valetCompany.trim() || null, bookingChannel: bookingChannel.trim() || null,
      grade: grade.trim() || null, directions: directions.trim() || null, babyMenu: babyMenu.trim() || null,
      recommend,
    })
    setEditing(false)
    onChanged()
  }
  const remove = async () => {
    if (!confirm(`'${place.name}' 장소를 족보에서 삭제할까요?`)) return
    const res = await api.places.delete(place.id)
    if (res.error) alert(res.error)
    onChanged()
  }

  if (editing) {
    return (
      <Modal title={`${place.name} 수정`} onClose={() => setEditing(false)}>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', border: 'none', padding: 0, margin: 0 }}>
          <div className="field"><label>이름</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field grow"><label>주소</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div className="field"><label>분류</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {EDIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select></div>
          <div className="field" style={{ maxWidth: 110 }}><label>평점 (0~5, .5 단위)</label>
            <input type="number" value={rating} min={0} max={5} step={0.5} placeholder="4.5" onChange={(e) => setRating(e.target.value)} /></div>
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
          {isValet && (
            <>
              <div className="field grow"><label>🚗 발렛사</label>
                <input type="text" value={valetCompany} placeholder="예: 투루발렛" onChange={(e) => setValetCompany(e.target.value)} /></div>
              <div className="field grow"><label>📞 예약 채널</label>
                <input type="text" value={bookingChannel} placeholder="예: 카카오톡 채널, 010-1234-5678"
                  onChange={(e) => setBookingChannel(e.target.value)} /></div>
            </>
          )}
          {isLodging && (
            <>
              <div className="field"><label>⭐ 성급</label>
                <input type="text" value={grade} placeholder="예: 4성급" onChange={(e) => setGrade(e.target.value)} /></div>
              <div className="field grow"><label>🚕 가는 법</label>
                <input type="text" value={directions} placeholder="예: 공항에서 리무진 버스 40분" onChange={(e) => setDirections(e.target.value)} /></div>
            </>
          )}
          {!isValet && (
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
              <div className="field grow"><label>🍽 추천 메뉴</label>
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
          <div className="field grow"><label>👍 장점</label>
            <input type="text" value={pros} placeholder="예: 조식 맛있음, 역에서 가까움" onChange={(e) => setPros(e.target.value)} /></div>
          <div className="field grow"><label>👎 단점</label>
            <input type="text" value={cons} placeholder="예: 방음이 약함" onChange={(e) => setCons(e.target.value)} /></div>
          <div style={{ marginTop: 12 }}>
            <button className="btn small primary" onClick={save}>저장</button>
            <button className="btn small" onClick={() => setEditing(false)} style={{ marginLeft: 6 }}>취소</button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <div className="place-card" onClick={() => setDetailOpen(true)}>
      {place.coverPhoto && <img className="place-card-photo" src={fileUrl(place.coverPhoto)} alt="" />}
      <div className="place-card-body">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span className="chip blue">{place.category}</span>
          {place.countryName && (
            <span className="chip purple">{flagEmoji(place.countryCode)} {place.countryName}{place.cityName ? ` · ${place.cityName}` : ''}</span>
          )}
          {place.rating != null && (
            <span className="chip yellow" style={{ color: ratingColor(place.rating), fontWeight: 800 }}>
              ★ {place.rating.toFixed(1)}
            </span>
          )}
          {place.reservationNeeded && <span className="chip pink">📌 예약 필요</span>}
          {place.grade && <span className="chip yellow">⭐ {place.grade}</span>}
          {place.recommend === true && <span className="chip green">👍 추천</span>}
          {place.recommend === false && <span className="chip pink">👎 비추천</span>}
        </div>
        <div style={{ fontWeight: 800 }}>{place.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div className="muted">
            {place.mapUrl ? (
              <a className="plain-link" href={place.mapUrl} target="_blank" rel="noreferrer"
                onClick={(e) => e.stopPropagation()} title="지도에서 보기">
                {place.address || '지도에서 보기'}
              </a>
            ) : (place.address || '주소 없음')}
            {place.memo ? ` · 📝 ${place.memo}` : ''}
          </div>
          {place.hours && <div className="muted">🕒 {place.hours}{place.breakTime ? ` (브레이크타임 ${place.breakTime})` : ''}</div>}
          {place.recommendedMenu && <div className="muted">🍽 추천: {place.recommendedMenu}</div>}
          {place.babyMenu && <div className="muted">🍼 영아 픽: {place.babyMenu}</div>}
          {place.directions && <div className="muted">🚕 {place.directions}</div>}
          {(place.valetCompany || place.bookingChannel) && (
            <div className="muted">
              {place.valetCompany && <>🚗 {place.valetCompany} </>}
              {place.bookingChannel && <>· 📞 {place.bookingChannel}</>}
            </div>
          )}
          {(place.pros || place.cons) && (
            <div className="muted">
              {place.pros && <>👍 {place.pros} </>}
              {place.cons && <>👎 {place.cons}</>}
            </div>
          )}
          {linkedBucketItems.length > 0 && (
            <div className="muted">✨ 위시리스트: {linkedBucketItems.map((b) => b.title).join(', ')}</div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
          <DropdownMenu actions={[
            { label: '✏️ 수정', onClick: () => setEditing(true) },
            { label: '🗑 삭제', danger: true, onClick: remove },
          ]} />
        </div>
      </div>
      {detailOpen && (
        <Modal title={`${place.name} · 방문 기록`} onClose={() => setDetailOpen(false)}>
          <PlaceDetailPanel placeId={place.id} />
        </Modal>
      )}
    </div>
  )
}

export default function PlacesScreen() {
  const [places, setPlaces] = useState<Place[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [bucket, setBucket] = useState<BucketItem[]>([])
  const [filter, setFilter] = useState('전체')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<GooglePlaceResult[]>([])
  const [searchError, setSearchError] = useState('')
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())

  const [manName, setManName] = useState('')
  const [manAddress, setManAddress] = useState('')
  const [manCategory, setManCategory] = useState('맛집')
  const [manMapUrl, setManMapUrl] = useState('')
  const [manCountryId, setManCountryId] = useState('')
  const [manCityId, setManCityId] = useState('')
  const [showAddPlace, setShowAddPlace] = useState(false)
  const [manResolving, setManResolving] = useState(false)
  const [manResolveError, setManResolveError] = useState('')

  const manCitiesOfCountry = cities.filter((c) => c.countryId === manCountryId)

  const resolveManMapLink = async () => {
    if (!manMapUrl.trim()) return
    setManResolving(true); setManResolveError('')
    const res = await api.places.resolveMapLink(manMapUrl.trim())
    setManResolving(false)
    if ('error' in res) { setManResolveError(res.error); return }
    if (res.address) setManAddress(res.address)
    if (res.name && !manName.trim()) setManName(res.name)
  }

  const refresh = () => {
    api.places.list().then(setPlaces)
    api.countries.list().then(setCountries)
    api.cities.list().then(setCities)
    api.bucket.list().then(setBucket)
  }
  useEffect(refresh, [])

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    setSearchError('')
    setResults([])
    const res = await api.places.googleSearch(query.trim())
    setSearching(false)
    if ('error' in res) { setSearchError(res.error); return }
    setResults(res)
    if (res.length === 0) setSearchError('검색 결과가 없어요.')
  }

  const saveResult = async (r: GooglePlaceResult) => {
    await api.places.create({
      name: r.name, address: r.address, category: mapCategory(r.category),
      lat: r.lat, lng: r.lng,
    })
    setSavedKeys((prev) => new Set(prev).add(r.name + r.address))
    refresh()
  }

  const addManual = async () => {
    if (!manName.trim()) return
    await api.places.create({
      name: manName, address: manAddress, category: manCategory, mapUrl: manMapUrl.trim() || null,
      countryId: manCountryId || null, cityId: manCityId || null,
    })
    setManName(''); setManAddress(''); setManMapUrl(''); setManCountryId(''); setManCityId('')
    setShowAddPlace(false)
    refresh()
  }

  const filtered = filter === '전체' ? places : places.filter((p) => p.category === filter)

  return (
    <div>
      <Window title="PLACE_SEARCH.EXE" color="green">
        <div className="form-row">
          <div className="field grow">
            <label>구글에서 장소 찾기 (온라인 필요 · 저장하면 우리 족보에 영구 보관)</label>
            <input type="text" value={query} placeholder="예: 후쿠오카 멘타이쥬"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()} />
          </div>
          <button className="btn primary" onClick={search} disabled={searching}>
            {searching ? '검색 중…' : '🔍 검색'}
          </button>
        </div>
        {searchError && <div className="error-text" style={{ marginTop: 8 }}>{searchError}</div>}
        {results.map((r, i) => {
          const saved = savedKeys.has(r.name + r.address)
          return (
            <div key={i} className="row" style={{ marginTop: i === 0 ? 12 : 0 }}>
              <span className="chip green">{r.category}</span>
              <div className="grow">
                <div style={{ fontWeight: 800 }}>
                  {r.name}{r.googleRating != null && <span className="muted"> · 구글 ★{r.googleRating}</span>}
                </div>
                <div className="muted">{r.address}</div>
              </div>
              <button className="btn small primary" disabled={saved} onClick={() => saveResult(r)}>
                {saved ? '저장됨 ✓' : '족보에 저장'}
              </button>
            </div>
          )
        })}
      </Window>

      <Window title="OUR_PLACES.EXE" color="purple">
        <p className="muted" style={{ marginTop: 0 }}>
          한 번 저장해두면 여러 여행에서 재사용할 수 있는 우리만의 장소 DB예요. 카드를 누르면 이 장소를 방문했던
          모든 여행의 리뷰·사진·꼭 해봐야 하는 것·누적 지출을 한 번에 모아 볼 수 있어요. 사진은 이 장소에서 찍어둔 사진이
          있으면 자동으로 카드에 표시돼요. 평점·장단점·국가/도시·구글 지도 링크는 등록 후 [수정]에서 채울 수 있어요.
        </p>
        <div className="row" style={{ marginBottom: 14 }}>
          <button className="btn primary small" onClick={() => setShowAddPlace(true)}>＋ 직접 등록</button>
        </div>

        {showAddPlace && (
          <Modal title="장소 직접 등록" onClose={() => setShowAddPlace(false)}>
            <div className="form-row">
              <div className="field">
                <label>이름</label>
                <input type="text" value={manName} onChange={(e) => setManName(e.target.value)} placeholder="장소명" />
              </div>
              <div className="field grow">
                <label>주소 (선택)</label>
                <input type="text" value={manAddress} onChange={(e) => setManAddress(e.target.value)} placeholder="주소" />
              </div>
              <div className="field">
                <label>분류</label>
                <Select value={manCategory} onChange={(e) => setManCategory(e.target.value)}>
                  {EDIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div className="field grow">
                <label>구글 지도 링크 (선택)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="text" value={manMapUrl} onChange={(e) => setManMapUrl(e.target.value)}
                    placeholder="https://maps.app.goo.gl/..." style={{ flex: 1 }} />
                  <button type="button" className="btn small" onClick={resolveManMapLink} disabled={manResolving || !manMapUrl.trim()}>
                    {manResolving ? '가져오는 중…' : '📍 주소 가져오기'}
                  </button>
                </div>
                {manResolveError && <div className="error-text" style={{ marginTop: 4 }}>{manResolveError}</div>}
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>국가 (선택)</label>
                <Select value={manCountryId} onChange={(e) => { setManCountryId(e.target.value); setManCityId('') }}>
                  <option value="">— 선택 안함 —</option>
                  {countries.map((c) => <option key={c.id} value={c.id}>{flagEmoji(c.code)} {c.name}</option>)}
                </Select>
              </div>
              {manCountryId && (
                <div className="field">
                  <label>도시 (선택)</label>
                  <Select value={manCityId} onChange={(e) => setManCityId(e.target.value)}>
                    <option value="">— 선택 안함 —</option>
                    {manCitiesOfCountry.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
              )}
            </div>
            <button className="btn primary" onClick={addManual}>＋ 등록</button>
          </Modal>
        )}

        <div className="day-tabs">
          {CATEGORIES.map((c) => (
            <button key={c} className={`pill ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty">등록된 장소가 없어요. 위에서 검색하거나 직접 등록해보세요!</div>
        ) : (
          <div className="grid">
            {filtered.map((p) => (
              <PlaceCard
                key={p.id}
                place={p}
                countries={countries}
                cities={cities}
                linkedBucketItems={bucket.filter((b) => b.linkedPlaceId === p.id)}
                onChanged={refresh}
              />
            ))}
          </div>
        )}
      </Window>
    </div>
  )
}

function mapCategory(googleCategory: string): string {
  const c = googleCategory.toLowerCase()
  if (/식당|음식|레스토랑|restaurant|food/.test(c)) return '맛집'
  if (/카페|커피|cafe|coffee|베이커리|bakery/.test(c)) return '카페'
  if (/공항|airport/.test(c)) return '공항'
  if (/호텔|숙소|hotel|료칸|게스트/.test(c)) return '숙소'
  if (/쇼핑|상점|시장|store|mall|market|백화점/.test(c)) return '쇼핑'
  if (/관광|명소|공원|신사|사원|박물관|attraction|park|museum|temple/.test(c)) return '명소'
  return '기타'
}
