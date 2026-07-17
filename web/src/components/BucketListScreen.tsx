import { useEffect, useState } from 'react'
import type { BucketKind } from '../../shared/types'
import { BUCKET_KIND_LABEL, BUCKET_KIND_CATEGORY, bucketKindOf } from '../../shared/types'
import { api } from '../api'
import { useBucket, useCountries, useCities, useTrips, usePlaces, useQueryClient, queryKeys } from '../queries'
import { flagEmoji } from '../categories'
import Window from './Window'
import Modal from './Modal'
import Select from './Select'
import BucketCard from './BucketCard'

const KINDS: BucketKind[] = ['bucket', 'food', 'wish']
const BUCKET_SUBCATEGORY_PRESETS = ['액티비티', '장소', '기타']

export default function BucketListScreen({
  autoOpenAdd, onConsumedAutoOpenAdd,
}: { autoOpenAdd?: boolean; onConsumedAutoOpenAdd?: () => void }) {
  const { data: items = [] } = useBucket()
  const { data: countries = [] } = useCountries()
  const { data: cities = [] } = useCities()
  const { data: trips = [] } = useTrips()
  const { data: places = [] } = usePlaces()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('todo')
  const [kindFilter, setKindFilter] = useState<'all' | BucketKind>('all')
  const [categoryFilter, setCategoryFilter] = useState('전체')

  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [tip, setTip] = useState('')
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

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.bucket })

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
      title: title.trim(), memo: memo.trim() || null, tip: tip.trim() || null,
      countryIds: [...selCountryIds], cityIds: [...selCityIds], category,
      linkedPlaceId: linkPlaceId || null, linkedTripId: linkTripId || null,
    })
    setTitle(''); setMemo(''); setTip(''); setKind('bucket'); setSubCategory('')
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
            <label>{kind === 'food' ? '💡 특징 · 알아야 할 TIP (선택)' : '💡 알아야 할 TIP (선택)'}</label>
            <textarea value={tip} placeholder={'예: 예약 필수 · 오전에 가면 한산함'}
              onChange={(e) => setTip(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>📝 느낀점 / 비고 (선택 · 여러 줄 가능)</label>
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
          <div className="bucket-photo-grid">
            {filtered.map((item) => (
              <BucketCard key={item.id} item={item} trips={trips} places={places} countries={countries} cities={cities} onChanged={refresh} />
            ))}
          </div>
        )}
      </Window>

      {/* 모바일: 화면 아래 떠 있는 + 버튼으로 바로 추가 */}
      <button type="button" className="fab" title="버킷리스트 추가" onClick={() => setShowAdd(true)}>＋</button>
    </div>
  )
}
