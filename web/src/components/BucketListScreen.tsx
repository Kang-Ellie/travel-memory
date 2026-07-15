import { useEffect, useRef, useState } from 'react'
import type { BucketItem, Country, City, Trip, Place, BucketKind } from '../../shared/types'
import { BUCKET_KIND_LABEL, BUCKET_KIND_CATEGORY, bucketKindOf } from '../../shared/types'
import { api, fileUrl } from '../api'
import { flagEmoji } from '../categories'
import Window from './Window'
import Modal from './Modal'
import Select from './Select'
import DropdownMenu from './DropdownMenu'
import PlaceMeta from './PlaceMeta'

const KINDS: BucketKind[] = ['bucket', 'food', 'wish']
const BUCKET_SUBCATEGORY_PRESETS = ['액티비티', '장소', '기타']

function BucketCard({
  item, trips, places, countries, cities, onChanged,
}: {
  item: BucketItem; trips: Trip[]; places: Place[]; countries: Country[]; cities: City[]; onChanged: () => void
}) {
  const [linking, setLinking] = useState(false)
  const [tripId, setTripId] = useState('')
  const [linkingPlace, setLinkingPlace] = useState(false)
  const [placeId, setPlaceId] = useState('')
  const photoInput = useRef<HTMLInputElement>(null)
  const linkedPlace = item.linkedPlaceId ? places.find((p) => p.id === item.linkedPlaceId) : undefined
  const coverPhoto = item.imagePath ?? linkedPlace?.coverPhoto ?? null

  const toggleDone = async () => {
    await api.bucket.update(item.id, { done: !item.done })
    onChanged()
  }
  const link = async () => {
    if (!tripId) return
    await api.bucket.update(item.id, { linkedTripId: tripId, done: true })
    setLinking(false)
    onChanged()
  }
  const unlink = async () => {
    await api.bucket.update(item.id, { linkedTripId: null })
    onChanged()
  }
  const linkPlace = async () => {
    if (!placeId) return
    await api.bucket.update(item.id, { linkedPlaceId: placeId })
    setLinkingPlace(false)
    onChanged()
  }
  const unlinkPlace = async () => {
    await api.bucket.update(item.id, { linkedPlaceId: null })
    onChanged()
  }
  const remove = async () => {
    if (!confirm(`'${item.title}' 항목을 삭제할까요?`)) return
    await api.bucket.delete(item.id)
    onChanged()
  }
  const onPhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await api.bucket.uploadPhoto(item.id, file)
    onChanged()
  }
  const removePhoto = async () => {
    await api.bucket.deletePhoto(item.id)
    onChanged()
  }

  const kind = bucketKindOf(item.category)
  const subCategory = kind === 'bucket' ? item.category : null
  const itemCountries = item.countryIds.map((id) => countries.find((c) => c.id === id)).filter((c): c is Country => !!c)
  const itemCities = item.cityIds.map((id) => cities.find((c) => c.id === id)).filter((c): c is City => !!c)

  const kindEmoji = kind === 'food' ? '🍽' : kind === 'wish' ? '🛍' : '🪣'
  const kindPastel = kind === 'food' ? 'var(--pink-soft)' : kind === 'wish' ? 'var(--blue-soft)' : 'var(--purple-soft)'

  return (
    <div className="card place-card" style={{ cursor: 'default' }}>
      {coverPhoto ? (
        <img className="place-card-photo" src={fileUrl(coverPhoto)} alt="" />
      ) : (
        <div className="place-card-photo-wrap place-card-photo-empty" style={{ background: kindPastel }}>
          <span>{kindEmoji}</span>
        </div>
      )}
      <input ref={photoInput} type="file" accept="image/*" hidden onChange={onPhotoPicked} />
      <div className="place-card-body">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <input type="checkbox" checked={item.done} onChange={toggleDone} title="완료로 표시" style={{ marginTop: 3 }} />
          <div className="grow" style={{ fontWeight: 800, textDecoration: item.done ? 'line-through' : undefined }}>
            {item.title}
          </div>
          <DropdownMenu actions={[
            { label: item.imagePath ? '📷 사진 변경' : '📷 사진 추가', onClick: () => photoInput.current?.click() },
            ...(item.imagePath ? [{ label: '🗑 사진 삭제', danger: true, onClick: removePhoto }] as const : []),
            'divider' as const,
            ...(item.linkedPlaceId
              ? [{ label: '장소 연결 해제', onClick: unlinkPlace }] as const
              : [{ label: '📍 장소 족보와 연결', onClick: () => setLinkingPlace(true) }] as const),
            ...(item.linkedTripId
              ? [{ label: '여행 연결 해제', onClick: unlink }] as const
              : [{ label: '여행에 연결', onClick: () => setLinking(true) }] as const),
            'divider' as const,
            { label: '🗑 삭제', danger: true, onClick: remove },
          ]} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span className="chip purple">{BUCKET_KIND_LABEL[kind]}</span>
          {subCategory && <span className="chip blue">{subCategory}</span>}
        </div>
        {itemCountries.length > 0 && (
          <div className="muted" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {itemCountries.map((co) => {
              const citiesHere = itemCities.filter((c) => c.countryId === co.id)
              return (
                <span key={co.id}>
                  {flagEmoji(co.code)} {co.name}{citiesHere.length > 0 ? ` · ${citiesHere.map((c) => c.name).join(', ')}` : ''}
                </span>
              )
            })}
          </div>
        )}
        {item.memo && <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{item.memo}</div>}
        {item.linkedPlaceId && <div className="muted">📍 {item.linkedPlaceName}</div>}
        {linkedPlace && <PlaceMeta place={linkedPlace} />}
        {item.linkedTripId && <div className="muted">✈️ {item.linkedTripTitle}에서 완료</div>}
        {linkingPlace && (
          <div className="row" style={{ border: 'none', padding: 0 }}>
            <Select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
              <option value="">— 장소 선택 —</option>
              {places.map((p) => <option key={p.id} value={p.id}>[{p.category}] {p.name}</option>)}
            </Select>
            <button className="btn small primary" onClick={linkPlace}>연결</button>
            <button className="btn small" onClick={() => setLinkingPlace(false)}>취소</button>
          </div>
        )}
        {linking && (
          <div className="row" style={{ border: 'none', padding: 0 }}>
            <Select value={tripId} onChange={(e) => setTripId(e.target.value)}>
              <option value="">— 여행 선택 —</option>
              {trips.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Select>
            <button className="btn small primary" onClick={link}>연결</button>
            <button className="btn small" onClick={() => setLinking(false)}>취소</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BucketListScreen({
  autoOpenAdd, onConsumedAutoOpenAdd,
}: { autoOpenAdd?: boolean; onConsumedAutoOpenAdd?: () => void }) {
  const [items, setItems] = useState<BucketItem[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('todo')
  const [kindFilter, setKindFilter] = useState<'all' | BucketKind>('all')
  const [categoryFilter, setCategoryFilter] = useState('전체')

  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [kind, setKind] = useState<BucketKind>('bucket')
  const [subCategory, setSubCategory] = useState('')
  const [selCountryIds, setSelCountryIds] = useState<Set<string>>(new Set())
  const [selCityIds, setSelCityIds] = useState<Set<string>>(new Set())
  const [linkPlaceId, setLinkPlaceId] = useState('')
  const [linkTripId, setLinkTripId] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (autoOpenAdd) { setShowAdd(true); onConsumedAutoOpenAdd?.() }
  }, [autoOpenAdd])

  const refresh = () => {
    api.bucket.list().then(setItems)
    api.countries.list().then(setCountries)
    api.cities.list().then(setCities)
    api.trips.list().then(setTrips)
    api.places.list().then(setPlaces)
  }
  useEffect(refresh, [])

  const toggleCountry = (id: string) => {
    setSelCountryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setSelCityIds((cPrev) => {
          const cNext = new Set(cPrev)
          for (const c of cities.filter((c) => c.countryId === id)) cNext.delete(c.id)
          return cNext
        })
      } else next.add(id)
      return next
    })
  }
  const toggleCity = (id: string) => {
    setSelCityIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const add = async () => {
    if (!title.trim()) return
    const category = kind === 'bucket' ? (subCategory.trim() || null) : BUCKET_KIND_CATEGORY[kind]
    await api.bucket.create({
      title: title.trim(), memo: memo.trim() || null,
      countryIds: [...selCountryIds], cityIds: [...selCityIds], category,
      linkedPlaceId: linkPlaceId || null, linkedTripId: linkTripId || null,
    })
    setTitle(''); setMemo(''); setKind('bucket'); setSubCategory('')
    setSelCountryIds(new Set()); setSelCityIds(new Set()); setLinkPlaceId(''); setLinkTripId('')
    setShowAdd(false)
    refresh()
  }

  const subCategories = ['전체', ...new Set(
    items.filter((i) => bucketKindOf(i.category) === 'bucket').map((i) => i.category).filter((c): c is string => !!c),
  )]
  const filtered = items
    .filter((i) => filter === 'all' || (filter === 'done' ? i.done : !i.done))
    .filter((i) => kindFilter === 'all' || bucketKindOf(i.category) === kindFilter)
    .filter((i) => kindFilter !== 'bucket' || categoryFilter === '전체' || i.category === categoryFilter)

  return (
    <div>
      <Window title="BUCKET_ADD.EXE" color="pink">
        <p className="muted" style={{ marginTop: 0 }}>
          가고 싶은 곳, 사고 싶은 것, 먹고 싶은 것을 자유롭게 적어두고, 실제 여행이 잡히면 그 여행에, 특정 장소가 있으면
          장소 족보에 연결해두세요. 한 도시를 여러 번 갈 수도 있으니 여기 남겨두면 다음에도 재사용할 수 있어요.
        </p>
        <button className="btn primary" onClick={() => setShowAdd(true)}>＋ 버킷리스트에 추가</button>
      </Window>

      {showAdd && (
        <Modal title="버킷리스트 추가" onClose={() => setShowAdd(false)}>
          <div className="field" style={{ marginBottom: 18 }}>
            <label>어떤 리스트인가요?</label>
            <div className="day-tabs" style={{ marginBottom: 0 }}>
              {KINDS.map((k) => (
                <button key={k} type="button" className={`pill ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>
                  {BUCKET_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <div className="field grow"><label>하고 싶은 것</label>
              <input type="text" value={title} placeholder="예: 삿포로 눈축제 가보기, 멘타이코 사기"
                onChange={(e) => setTitle(e.target.value)} /></div>
            {kind === 'bucket' && (
              <div className="field"><label>세부 카테고리 (선택)</label>
                <input type="text" value={subCategory} list="bucket-subcategory-presets" placeholder="예: 액티비티"
                  onChange={(e) => setSubCategory(e.target.value)} />
                <datalist id="bucket-subcategory-presets">
                  {BUCKET_SUBCATEGORY_PRESETS.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            )}
          </div>
          <div className="field" style={{ marginBottom: 18 }}>
            <label>국가 (여러 곳 선택 가능)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {countries.map((c) => (
                <button key={c.id} type="button" className={`pill ${selCountryIds.has(c.id) ? 'active' : ''}`}
                  onClick={() => toggleCountry(c.id)}>
                  {flagEmoji(c.code)} {c.name}
                </button>
              ))}
            </div>
          </div>
          {[...selCountryIds].map((countryId) => {
            const country = countries.find((c) => c.id === countryId)
            const citiesOfCountry = cities.filter((c) => c.countryId === countryId)
            if (citiesOfCountry.length === 0) return null
            return (
              <div key={countryId} className="field" style={{ marginBottom: 18 }}>
                <label>{flagEmoji(country?.code)} {country?.name} 도시 (여러 곳 선택 가능)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {citiesOfCountry.map((c) => (
                    <button key={c.id} type="button" className={`pill ${selCityIds.has(c.id) ? 'active' : ''}`}
                      onClick={() => toggleCity(c.id)}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <div className="form-row">
            <div className="field grow"><label>장소 족보와 연결 (선택)</label>
              <Select value={linkPlaceId} onChange={(e) => setLinkPlaceId(e.target.value)}>
                <option value="">— 선택 안함 —</option>
                {places.map((p) => <option key={p.id} value={p.id}>[{p.category}] {p.name}</option>)}
              </Select></div>
            <div className="field grow"><label>여행에 연결 (선택)</label>
              <Select value={linkTripId} onChange={(e) => setLinkTripId(e.target.value)}>
                <option value="">— 선택 안함 —</option>
                {trips.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select></div>
          </div>
          <div className="field">
            <label>비고 (선택 · 여러 줄 가능)</label>
            <textarea value={memo} placeholder={'예:\n회원 할인 있음\n예약은 최소 1주일 전에'}
              onChange={(e) => setMemo(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={add}>＋ 버킷리스트에 추가</button>
          </div>
        </Modal>
      )}

      <Window title="BUCKET_LIST.EXE" color="purple">
        <div className="day-tabs">
          {(['all', ...KINDS] as const).map((k) => (
            <button key={k} className={`pill ${kindFilter === k ? 'active' : ''}`} onClick={() => { setKindFilter(k); setCategoryFilter('전체') }}>
              {k === 'all' ? '전체' : BUCKET_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="day-tabs">
          {(['todo', 'done', 'all'] as const).map((f) => (
            <button key={f} className={`pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'todo' ? '할 것' : f === 'done' ? '완료' : '전체'}
            </button>
          ))}
        </div>
        {kindFilter === 'bucket' && subCategories.length > 1 && (
          <div className="day-tabs">
            {subCategories.map((c) => (
              <button key={c} className={`pill ${categoryFilter === c ? 'active' : ''}`} onClick={() => setCategoryFilter(c)}>{c}</button>
            ))}
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="empty">항목이 없어요.</div>
        ) : (
          <div className="grid">
            {filtered.map((item) => (
              <BucketCard key={item.id} item={item} trips={trips} places={places} countries={countries} cities={cities} onChanged={refresh} />
            ))}
          </div>
        )}
      </Window>
    </div>
  )
}
