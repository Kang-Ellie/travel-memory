import { useEffect, useState } from 'react'
import type { Place, GooglePlaceResult, Country, City, BucketItem } from '../../shared/types'
import { api } from '../api'
import { flagEmoji, ratingColor } from '../categories'
import Window from './Window'
import PlaceDetailPanel from './PlaceDetailPanel'

const CATEGORIES = ['전체', '맛집', '카페', '명소', '쇼핑', '숙소', '공항', '기타']
const EDIT_CATEGORIES = CATEGORIES.slice(1)

function PlaceRow({
  place, countries, cities, linkedBucketItems, expanded, onToggle, onChanged,
}: {
  place: Place; countries: Country[]; cities: City[]; linkedBucketItems: BucketItem[]
  expanded: boolean; onToggle: () => void; onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
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

  const citiesOfCountry = cities.filter((c) => c.countryId === countryId)

  const save = async () => {
    const r = rating.trim() === '' ? null : Number(rating)
    await api.places.update(place.id, {
      name, address, category, memo: memo.trim() || null, mapUrl: mapUrl.trim() || null,
      rating: r != null && !Number.isNaN(r) ? r : null,
      pros: pros.trim() || null, cons: cons.trim() || null,
      countryId: countryId || null, cityId: cityId || null,
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
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--yellow-soft)' }}>
        <div className="field"><label>이름</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field grow"><label>주소</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="field"><label>분류</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {EDIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div className="field" style={{ maxWidth: 110 }}><label>평점 (0~5, .5 단위)</label>
          <input type="number" value={rating} min={0} max={5} step={0.5} placeholder="4.5" onChange={(e) => setRating(e.target.value)} /></div>
        <div className="field grow"><label>구글 지도 링크</label>
          <input type="text" value={mapUrl} placeholder="https://maps.app.goo.gl/..." onChange={(e) => setMapUrl(e.target.value)} /></div>
        <div className="field"><label>국가 (선택)</label>
          <select value={countryId} onChange={(e) => { setCountryId(e.target.value); setCityId('') }}>
            <option value="">— 선택 안함 —</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{flagEmoji(c.code)} {c.name}</option>)}
          </select></div>
        {countryId && (
          <div className="field"><label>도시 (선택)</label>
            <select value={cityId} onChange={(e) => setCityId(e.target.value)}>
              <option value="">— 선택 안함 —</option>
              {citiesOfCountry.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
        )}
        <div className="field grow"><label>메모</label>
          <input type="text" value={memo} placeholder="우리끼리 메모" onChange={(e) => setMemo(e.target.value)} /></div>
        <div className="field grow"><label>👍 장점</label>
          <input type="text" value={pros} placeholder="예: 조식 맛있음, 역에서 가까움" onChange={(e) => setPros(e.target.value)} /></div>
        <div className="field grow"><label>👎 단점</label>
          <input type="text" value={cons} placeholder="예: 방음이 약함" onChange={(e) => setCons(e.target.value)} /></div>
        <button className="btn small primary" onClick={save}>저장</button>
        <button className="btn small" onClick={() => setEditing(false)}>취소</button>
      </div>
    )
  }

  return (
    <div>
      <div className="row" style={{ cursor: 'pointer', flexWrap: 'wrap' }} onClick={onToggle}>
        <span className="chip blue">{place.category}</span>
        {place.countryName && (
          <span className="chip purple">{flagEmoji(place.countryCode)} {place.countryName}{place.cityName ? ` · ${place.cityName}` : ''}</span>
        )}
        {place.rating != null && (
          <span className="chip yellow" style={{ color: ratingColor(place.rating), fontWeight: 800 }}>
            ★ {place.rating.toFixed(1)}
          </span>
        )}
        <div className="grow">
          <div style={{ fontWeight: 800 }}>
            {place.name}
            {place.lat != null && <span title="좌표 있음 — 지도 표시 가능"> 🗺</span>}
          </div>
          <div className="muted">{place.address || '주소 없음'}{place.memo ? ` · 📝 ${place.memo}` : ''}</div>
          {(place.pros || place.cons) && (
            <div className="muted">
              {place.pros && <>👍 {place.pros} </>}
              {place.cons && <>👎 {place.cons}</>}
            </div>
          )}
        </div>
        <span className="muted">{expanded ? '접기 ▲' : '방문 기록 보기 ▼'}</span>
        {place.mapUrl && (
          <a className="btn small" href={place.mapUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            🗺 지도
          </a>
        )}
        <button className="btn small" onClick={(e) => { e.stopPropagation(); setEditing(true) }}>수정</button>
        <button className="btn small ghost" onClick={(e) => { e.stopPropagation(); remove() }}>×</button>
      </div>
      {linkedBucketItems.length > 0 && (
        <div className="muted" style={{ padding: '0 12px 8px' }}>
          ✨ 위시리스트: {linkedBucketItems.map((b) => b.title).join(', ')}
        </div>
      )}
      {expanded && <PlaceDetailPanel placeId={place.id} />}
    </div>
  )
}

export default function PlacesScreen() {
  const [places, setPlaces] = useState<Place[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [bucket, setBucket] = useState<BucketItem[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
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
    await api.places.create({ name: manName, address: manAddress, category: manCategory, mapUrl: manMapUrl.trim() || null })
    setManName(''); setManAddress(''); setManMapUrl('')
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
          한 번 저장해두면 여러 여행에서 재사용할 수 있는 우리만의 장소 DB예요. 이름을 누르면 이 장소를 방문했던
          모든 여행의 리뷰·사진·꼭 해봐야 하는 것·누적 지출을 한 번에 모아 볼 수 있어요. 평점·장단점·국가/도시·구글 지도
          링크는 등록 후 [수정]에서 채울 수 있어요.
        </p>
        <div className="form-row" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>직접 등록 — 이름</label>
            <input type="text" value={manName} onChange={(e) => setManName(e.target.value)} placeholder="장소명" />
          </div>
          <div className="field grow">
            <label>주소 (선택)</label>
            <input type="text" value={manAddress} onChange={(e) => setManAddress(e.target.value)} placeholder="주소" />
          </div>
          <div className="field">
            <label>분류</label>
            <select value={manCategory} onChange={(e) => setManCategory(e.target.value)}>
              {EDIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field grow">
            <label>구글 지도 링크 (선택)</label>
            <input type="text" value={manMapUrl} onChange={(e) => setManMapUrl(e.target.value)} placeholder="https://maps.app.goo.gl/..." />
          </div>
          <button className="btn" onClick={addManual}>＋ 등록</button>
        </div>

        <div className="day-tabs">
          {CATEGORIES.map((c) => (
            <button key={c} className={`pill ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty">등록된 장소가 없어요. 위에서 검색하거나 직접 등록해보세요!</div>
        ) : filtered.map((p) => (
          <PlaceRow
            key={p.id}
            place={p}
            countries={countries}
            cities={cities}
            linkedBucketItems={bucket.filter((b) => b.linkedPlaceId === p.id)}
            expanded={expandedId === p.id}
            onToggle={() => setExpandedId((cur) => (cur === p.id ? null : p.id))}
            onChanged={refresh}
          />
        ))}
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
