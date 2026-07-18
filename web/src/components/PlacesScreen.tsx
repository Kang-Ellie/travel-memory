import { useEffect, useState } from 'react'
import type { Place, GooglePlaceResult, Country, City, BucketItem } from '../../shared/types'
import { api } from '../api'
import { usePlaces, useCountries, useCities, useBucket, useQueryClient, queryKeys } from '../queries'
import { flagEmoji, ratingColor, displayRating, googleMapsUrl, CATEGORY_EMOJI, CATEGORY_PASTEL, CATEGORIES, EDIT_CATEGORIES } from '../categories'
import { toast } from '../toast'
import Window from './Window'
import Modal from './Modal'
import Select from './Select'
import PlaceDetailPanel from './PlaceDetailPanel'
import PlaceEditModal from './PlaceEditModal'
import DropdownMenu from './DropdownMenu'
import PlacesMapView from './PlacesMapView'
import Thumb from './Thumb'
import { SkeletonGrid } from './Skeleton'

function PlaceCard({
  place, countries, cities, linkedBucketItems, onChanged,
}: {
  place: Place; countries: Country[]; cities: City[]; linkedBucketItems: BucketItem[]
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const shownRating = displayRating(place)

  const remove = async () => {
    if (!confirm(`'${place.name}' 장소를 족보에서 삭제할까요?`)) return
    const res = await api.places.delete(place.id)
    if (res.error) toast.error(res.error)
    else toast.success('삭제했어요.')
    onChanged()
  }

  if (editing) {
    return (
      <PlaceEditModal place={place} countries={countries} cities={cities}
        onClose={() => setEditing(false)} onSaved={onChanged} />
    )
  }

  return (
    <div className="card place-card" onClick={() => setDetailOpen(true)}>
      {place.coverPhoto ? (
        <div className="place-card-photo-wrap">
          <Thumb className="place-card-photo" path={place.coverPhoto} />
          {place.visitCount > 0 && <span className="place-visit-badge">🔁 {place.visitCount}번 방문</span>}
        </div>
      ) : (
        <div className="place-card-photo-wrap place-card-photo-empty"
          style={{ background: CATEGORY_PASTEL[place.category] ?? 'var(--purple-soft)' }}>
          <span>{CATEGORY_EMOJI[place.category] ?? '📍'}</span>
          {place.visitCount > 0 && <span className="place-visit-badge">🔁 {place.visitCount}번 방문</span>}
        </div>
      )}
      <div className="place-card-body">
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <div className="place-card-name">{place.name}</div>
          <div style={{ marginLeft: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <DropdownMenu actions={[
              { label: '✏️ 수정', onClick: () => setEditing(true) },
              { label: '🗑 삭제', danger: true, onClick: remove },
            ]} />
          </div>
        </div>
        <div className="place-card-rating-row">
          {shownRating != null && (
            <span className="place-card-rating" style={{ color: ratingColor(shownRating) }} title={place.rating == null ? '방문 평균 평점' : '내가 매긴 종합 평점'}>
              ★ {shownRating.toFixed(1)}
            </span>
          )}
          {place.recommend === true && <span className="chip green">👍 추천</span>}
          {place.recommend === false && <span className="chip pink">👎 비추천</span>}
          {place.reservationNeeded && <span className="chip pink">📌 예약</span>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span className="chip blue">{place.category}</span>
          {place.countryName && (
            <span className="chip purple">{flagEmoji(place.countryCode)} {place.cityName ?? place.countryName}</span>
          )}
        </div>
        <div className="muted place-card-address">
          {googleMapsUrl(place) ? (
            <a className="plain-link" href={googleMapsUrl(place)!} target="_blank" rel="noreferrer"
              onClick={(e) => e.stopPropagation()} title="지도에서 보기">
              {place.address || '지도에서 보기'}
            </a>
          ) : (place.address || '주소 없음')}
          {(place.lat != null && place.lng != null) || place.address ? (
            <a className="plain-link" style={{ marginLeft: 8 }}
              href={`https://www.google.com/maps/dir/?api=1&destination=${
                place.lat != null && place.lng != null
                  ? `${place.lat},${place.lng}`
                  : encodeURIComponent(place.address)
              }`}
              target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="구글 지도로 길찾기">
              🧭 길찾기
            </a>
          ) : null}
        </div>
        {linkedBucketItems.length > 0 && (
          <div className="muted">✨ {linkedBucketItems.map((b) => b.title).join(', ')}</div>
        )}
      </div>
      {detailOpen && (
        <Modal title={`${place.name} · 방문 기록`} onClose={() => setDetailOpen(false)}>
          <PlaceDetailPanel placeId={place.id} />
        </Modal>
      )}
    </div>
  )
}

export default function PlacesScreen({
  autoOpenAdd, onConsumedAutoOpenAdd,
}: { autoOpenAdd?: boolean; onConsumedAutoOpenAdd?: () => void }) {
  const { data: places = [], isPending: placesLoading } = usePlaces()
  const { data: countries = [] } = useCountries()
  const { data: cities = [] } = useCities()
  const { data: bucket = [] } = useBucket()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('전체')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<GooglePlaceResult[]>([])
  const [searchError, setSearchError] = useState('')
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [placesView, setPlacesView] = useState<'grid' | 'map'>('grid')

  const [manName, setManName] = useState('')
  const [manAddress, setManAddress] = useState('')
  const [manCategory, setManCategory] = useState('맛집')
  const [manMapUrl, setManMapUrl] = useState('')
  const [manCountryId, setManCountryId] = useState('')
  const [manCityId, setManCityId] = useState('')
  const [showAddPlace, setShowAddPlace] = useState(false)
  const [manResolving, setManResolving] = useState(false)
  const [manResolveError, setManResolveError] = useState('')

  useEffect(() => {
    if (autoOpenAdd) { setShowAddPlace(true); onConsumedAutoOpenAdd?.() }
  }, [autoOpenAdd])

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

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.places })

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
      <div className="grid">
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

      <Window title="BOOKMARK_ADD.EXE" color="blue">
        <p className="muted" style={{ marginTop: 0 }}>
          구글 검색에 안 나오는 곳이거나 주소를 직접 알고 있으면 여기서 바로 등록하세요.
        </p>
        <button className="btn primary small" onClick={() => setShowAddPlace(true)}>＋ 직접 등록</button>

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
      </Window>
      </div>

      <Window title="OUR_PLACES.EXE" color="purple">
        <p className="muted" style={{ marginTop: 0 }}>
          한 번 저장해두면 여러 여행에서 재사용할 수 있는 우리만의 장소 DB예요. 카드를 누르면 이 장소를 방문했던
          모든 여행의 리뷰·사진·꼭 해봐야 하는 것·누적 지출을 한 번에 모아 볼 수 있어요. 사진은 이 장소에서 찍어둔 사진이
          있으면 자동으로 카드에 표시돼요. 평점·장단점·국가/도시·구글 지도 링크는 등록 후 [수정]에서 채울 수 있어요.
        </p>
        <div className="day-tabs">
          {CATEGORIES.map((c) => (
            <button key={c} className={`pill ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>
        <div className="right-toggle">
          <button className={`pill ${placesView === 'grid' ? 'active' : ''}`} onClick={() => setPlacesView('grid')}>🗂 목록</button>
          <button className={`pill ${placesView === 'map' ? 'active' : ''}`} onClick={() => setPlacesView('map')}>🗺 지도로 보기</button>
        </div>

        {placesLoading ? (
          <SkeletonGrid />
        ) : filtered.length === 0 ? (
          <div className="empty">등록된 장소가 없어요. 위에서 검색하거나 직접 등록해보세요!</div>
        ) : placesView === 'map' ? (
          <PlacesMapView places={filtered} />
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
  // 주차/발렛을 공항보다 먼저 체크 — "인천공항 단기주차장"처럼 두 단어가 같이 나오는
  // 곳은 발렛(주차) 쪽이 실제 용도에 더 맞다.
  if (/주차|발렛|파킹|parking|valet/.test(c)) return '발렛'
  if (/공항|airport/.test(c)) return '공항'
  if (/호텔|숙소|hotel|료칸|게스트/.test(c)) return '숙소'
  if (/쇼핑|상점|시장|store|mall|market|백화점/.test(c)) return '쇼핑'
  if (/관광|명소|공원|신사|사원|박물관|attraction|park|museum|temple/.test(c)) return '명소'
  return '기타'
}
