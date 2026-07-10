import { useEffect, useState } from 'react'
import type { BucketItem, Country, City, Trip, Place } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import Window from './Window'
import Modal from './Modal'
import Select from './Select'

const CATEGORY_PRESETS = ['쇼핑', '음식', '액티비티', '장소', '기타']

function BucketRow({
  item, trips, places, onChanged,
}: { item: BucketItem; trips: Trip[]; places: Place[]; onChanged: () => void }) {
  const [linking, setLinking] = useState(false)
  const [tripId, setTripId] = useState('')
  const [linkingPlace, setLinkingPlace] = useState(false)
  const [placeId, setPlaceId] = useState('')

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

  return (
    <div className="row" style={{ flexWrap: 'wrap' }}>
      <input type="checkbox" checked={item.done} onChange={toggleDone} title="완료로 표시" />
      <div className="grow">
        <div style={{ fontWeight: 800, textDecoration: item.done ? 'line-through' : undefined }}>
          {item.title}
          {item.category && <span className="chip purple" style={{ marginLeft: 8 }}>{item.category}</span>}
        </div>
        <div className="muted">
          {item.countryName && <>🌍 {item.countryName}{item.cityName && ` · ${item.cityName}`} </>}
          {item.memo}
        </div>
        {item.linkedPlaceId ? (
          <div className="muted" style={{ marginTop: 2 }}>
            📍 {item.linkedPlaceName}
            <button className="btn small ghost" style={{ marginLeft: 6 }} onClick={unlinkPlace}>연결 해제</button>
          </div>
        ) : linkingPlace ? (
          <div className="row" style={{ marginTop: 6, border: 'none', padding: 0 }}>
            <Select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
              <option value="">— 장소 선택 —</option>
              {places.map((p) => <option key={p.id} value={p.id}>[{p.category}] {p.name}</option>)}
            </Select>
            <button className="btn small primary" onClick={linkPlace}>연결</button>
            <button className="btn small" onClick={() => setLinkingPlace(false)}>취소</button>
          </div>
        ) : (
          <button className="btn small ghost" style={{ marginTop: 2 }} onClick={() => setLinkingPlace(true)}>📍 장소 족보와 연결</button>
        )}
        {item.linkedTripId && (
          <div className="muted" style={{ marginTop: 2 }}>
            ✈️ {item.linkedTripTitle}에서 완료
            <button className="btn small ghost" style={{ marginLeft: 6 }} onClick={unlink}>연결 해제</button>
          </div>
        )}
      </div>
      {!item.linkedTripId && (
        linking ? (
          <>
            <Select value={tripId} onChange={(e) => setTripId(e.target.value)}>
              <option value="">— 여행 선택 —</option>
              {trips.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Select>
            <button className="btn small primary" onClick={link}>연결</button>
            <button className="btn small" onClick={() => setLinking(false)}>취소</button>
          </>
        ) : (
          <button className="btn small" onClick={() => setLinking(true)}>여행에 연결</button>
        )
      )}
      <button className="btn small ghost" onClick={remove}>×</button>
    </div>
  )
}

export default function BucketListScreen() {
  const [items, setItems] = useState<BucketItem[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('todo')
  const [categoryFilter, setCategoryFilter] = useState('전체')

  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [category, setCategory] = useState('')
  const [countryId, setCountryId] = useState('')
  const [cityId, setCityId] = useState('')
  const [linkPlaceId, setLinkPlaceId] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const refresh = () => {
    api.bucket.list().then(setItems)
    api.countries.list().then(setCountries)
    api.cities.list().then(setCities)
    api.trips.list().then(setTrips)
    api.places.list().then(setPlaces)
  }
  useEffect(refresh, [])

  const citiesOfCountry = cities.filter((c) => c.countryId === countryId)

  const add = async () => {
    if (!title.trim()) return
    await api.bucket.create({
      title: title.trim(), memo: memo.trim() || null,
      countryId: countryId || null, cityId: cityId || null, category: category.trim() || null,
      linkedPlaceId: linkPlaceId || null,
    })
    setTitle(''); setMemo(''); setCategory(''); setCountryId(''); setCityId(''); setLinkPlaceId('')
    setShowAdd(false)
    refresh()
  }

  const categories = ['전체', ...new Set(items.map((i) => i.category).filter((c): c is string => !!c))]
  const filtered = items
    .filter((i) => filter === 'all' || (filter === 'done' ? i.done : !i.done))
    .filter((i) => categoryFilter === '전체' || i.category === categoryFilter)

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
          <div className="form-row">
            <div className="field grow"><label>하고 싶은 것</label>
              <input type="text" value={title} placeholder="예: 삿포로 눈축제 가보기, 멘타이코 사기"
                onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="field"><label>카테고리 (선택)</label>
              <input type="text" value={category} list="bucket-category-presets" placeholder="예: 쇼핑, 음식"
                onChange={(e) => setCategory(e.target.value)} />
              <datalist id="bucket-category-presets">
                {CATEGORY_PRESETS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div className="form-row">
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
            <div className="field"><label>장소 족보와 연결 (선택)</label>
              <Select value={linkPlaceId} onChange={(e) => setLinkPlaceId(e.target.value)}>
                <option value="">— 선택 안함 —</option>
                {places.map((p) => <option key={p.id} value={p.id}>[{p.category}] {p.name}</option>)}
              </Select></div>
            <div className="field grow"><label>비고 (선택)</label>
              <input type="text" value={memo} placeholder="예: 회원 할인 있음"
                onChange={(e) => setMemo(e.target.value)} /></div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={add}>＋ 버킷리스트에 추가</button>
          </div>
        </Modal>
      )}

      <Window title="BUCKET_LIST.EXE" color="purple">
        <div className="day-tabs">
          {(['todo', 'done', 'all'] as const).map((f) => (
            <button key={f} className={`pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'todo' ? '할 것' : f === 'done' ? '완료' : '전체'}
            </button>
          ))}
        </div>
        {categories.length > 1 && (
          <div className="day-tabs">
            {categories.map((c) => (
              <button key={c} className={`pill ${categoryFilter === c ? 'active' : ''}`} onClick={() => setCategoryFilter(c)}>{c}</button>
            ))}
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="empty">항목이 없어요.</div>
        ) : filtered.map((item) => <BucketRow key={item.id} item={item} trips={trips} places={places} onChanged={refresh} />)}
      </Window>
    </div>
  )
}
