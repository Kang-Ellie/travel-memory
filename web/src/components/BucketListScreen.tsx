import { useEffect, useState } from 'react'
import type { BucketItem, Country, City, Trip } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import Window from './Window'

function BucketRow({ item, trips, onChanged }: { item: BucketItem; trips: Trip[]; onChanged: () => void }) {
  const [linking, setLinking] = useState(false)
  const [tripId, setTripId] = useState('')

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
            <select value={tripId} onChange={(e) => setTripId(e.target.value)}>
              <option value="">— 여행 선택 —</option>
              {trips.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
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
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('todo')

  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [category, setCategory] = useState('')
  const [countryId, setCountryId] = useState('')
  const [cityId, setCityId] = useState('')

  const refresh = () => {
    api.bucket.list().then(setItems)
    api.countries.list().then(setCountries)
    api.cities.list().then(setCities)
    api.trips.list().then(setTrips)
  }
  useEffect(refresh, [])

  const citiesOfCountry = cities.filter((c) => c.countryId === countryId)

  const add = async () => {
    if (!title.trim()) return
    await api.bucket.create({
      title: title.trim(), memo: memo.trim() || null,
      countryId: countryId || null, cityId: cityId || null, category: category.trim() || null,
    })
    setTitle(''); setMemo(''); setCategory(''); setCountryId(''); setCityId('')
    refresh()
  }

  const filtered = items.filter((i) => filter === 'all' || (filter === 'done' ? i.done : !i.done))

  return (
    <div>
      <Window title="BUCKET_ADD.EXE" color="pink">
        <p className="muted" style={{ marginTop: 0 }}>
          가고 싶은 곳, 하고 싶은 것을 자유롭게 적어두고, 나중에 실제 여행이 잡히면 그 여행에 연결해서 완료로 표시할 수 있어요.
        </p>
        <div className="form-row">
          <div className="field grow"><label>하고 싶은 것</label>
            <input type="text" value={title} placeholder="예: 삿포로 눈축제 가보기"
              onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label>카테고리 (선택)</label>
            <input type="text" value={category} placeholder="예: 액티비티" onChange={(e) => setCategory(e.target.value)} /></div>
        </div>
        <div className="form-row" style={{ marginTop: 8 }}>
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
          <div className="field grow"><label>메모 (선택)</label>
            <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} /></div>
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={add}>＋ 버킷리스트에 추가</button>
        </div>
      </Window>

      <Window title="BUCKET_LIST.EXE" color="purple">
        <div className="day-tabs">
          {(['todo', 'done', 'all'] as const).map((f) => (
            <button key={f} className={`pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'todo' ? '할 것' : f === 'done' ? '완료' : '전체'}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div className="empty">항목이 없어요.</div>
        ) : filtered.map((item) => <BucketRow key={item.id} item={item} trips={trips} onChanged={refresh} />)}
      </Window>
    </div>
  )
}
