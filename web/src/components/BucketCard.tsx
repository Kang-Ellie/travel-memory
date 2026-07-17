import { useRef, useState } from 'react'
import type { BucketItem, Country, City, Trip, Place } from '../../shared/types'
import { bucketKindOf } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import Modal from './Modal'
import Select from './Select'
import DropdownMenu from './DropdownMenu'
import PlaceMeta from './PlaceMeta'
import Thumb from './Thumb'

const KIND_EMOJI = { bucket: '🪣', food: '🍽', wish: '🛍' } as const
const KIND_LABEL = { bucket: '🪣 버킷리스트', food: '🍽 먹킷리스트', wish: '🛍 위시리스트' } as const
const KIND_PASTEL = {
  bucket: 'linear-gradient(160deg, var(--purple-soft), var(--pink-soft))',
  food: 'linear-gradient(160deg, var(--pink-soft), var(--yellow-soft))',
  wish: 'linear-gradient(160deg, var(--blue-soft), var(--purple-soft))',
} as const

// 북마크(버킷/먹킷/위시)와 여행 상세("이번엔 어디?")에서 같은 카드 느낌으로 보이게 공용화.
// tripContext가 있으면 "이 여행에 담기" 같은 여행 문맥 액션으로 바뀐다.
export default function BucketCard({
  item, trips, places, countries, cities, onChanged, tripContext,
}: {
  item: BucketItem; trips: Trip[]; places: Place[]; countries: Country[]; cities: City[]; onChanged: () => void
  tripContext?: { tripId: string }
}) {
  const [linking, setLinking] = useState(false)
  const [tripId, setTripId] = useState('')
  const [linkingPlace, setLinkingPlace] = useState(false)
  const [placeId, setPlaceId] = useState('')
  const [editing, setEditing] = useState(false)
  const [memo, setMemo] = useState(item.memo ?? '')
  const [tip, setTip] = useState(item.tip ?? '')
  const photoInput = useRef<HTMLInputElement>(null)
  const linkedPlace = item.linkedPlaceId ? places.find((p) => p.id === item.linkedPlaceId) : undefined

  const saveNotes = async () => {
    await api.bucket.update(item.id, { memo: memo.trim() || null, tip: tip.trim() || null })
    setEditing(false)
    onChanged()
  }
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
  const addToTrip = async () => {
    if (!tripContext) return
    await api.bucket.update(item.id, { linkedTripId: tripContext.tripId })
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
    // 사진을 올렸다 = 실제로 다녀왔다는 뜻 → 도장 찍히며 자동 완료 처리
    if (!item.done) await api.bucket.update(item.id, { done: true })
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

  const tripActions = tripContext
    ? (item.linkedTripId === tripContext.tripId
        ? [{ label: '여행 연결 해제', onClick: unlink }] as const
        : [{ label: '＋ 이 여행에 담기', onClick: addToTrip }] as const)
    : (item.linkedTripId
        ? [{ label: '여행 연결 해제', onClick: unlink }] as const
        : [{ label: '여행에 연결', onClick: () => setLinking(true) }] as const)

  return (
    <>
    <div className={`bucket-photo-card ${item.done ? 'done' : ''}`}>
      <input ref={photoInput} type="file" accept="image/*" hidden onChange={onPhotoPicked} />
      <div className="bucket-photo-media">
        {coverPhoto ? (
          <Thumb path={coverPhoto} />
        ) : (
          <div className="bucket-photo-media-empty" style={{ background: KIND_PASTEL[kind] }}>{KIND_EMOJI[kind]}</div>
        )}
        <div className="bucket-photo-top">
          <span className="bucket-photo-chip">{KIND_LABEL[kind]}</span>
          {subCategory && <span className="bucket-photo-chip">#{subCategory}</span>}
          <span className="bucket-photo-menu">
            <DropdownMenu actions={[
              { label: '✏️ 수정', onClick: () => setEditing(true) },
              { label: item.imagePath ? '📷 사진 변경' : '📷 사진 추가', onClick: () => photoInput.current?.click() },
              ...(item.imagePath ? [{ label: '🗑 사진 삭제', danger: true, onClick: removePhoto }] as const : []),
              'divider' as const,
              ...(item.linkedPlaceId
                ? [{ label: '장소 연결 해제', onClick: unlinkPlace }] as const
                : [{ label: '📍 장소 족보와 연결', onClick: () => setLinkingPlace(true) }] as const),
              ...tripActions,
              'divider' as const,
              { label: '🗑 삭제', danger: true, onClick: remove },
            ]} />
          </span>
        </div>
        {item.done && (
          <span className="stamp small green bucket-done-stamp"><span className="stamp-text">DONE</span></span>
        )}
        <div className="bucket-photo-overlay">
          {itemCountries.length > 0 && (
            <div className="bucket-photo-geo">
              {itemCountries.map((co) => {
                const citiesHere = itemCities.filter((c) => c.countryId === co.id)
                return (
                  <span key={co.id} style={{ marginRight: 8 }}>
                    {flagEmoji(co.code)} {co.name}{citiesHere.length > 0 ? ` · ${citiesHere.map((c) => c.name).join(', ')}` : ''}
                  </span>
                )
              })}
            </div>
          )}
          <div className="bucket-photo-title">{item.title}</div>
          {item.linkedPlaceId && <div className="bucket-photo-sub">📍 {item.linkedPlaceName}</div>}
          {item.linkedTripId && <div className="bucket-photo-sub">✈️ {item.linkedTripTitle}에서{item.done ? ' 완료' : ''}</div>}
        </div>
        <button
          type="button"
          className="bucket-done-toggle"
          title={item.done ? '미완료로 되돌리기' : '완료로 표시'}
          onClick={toggleDone}
        >
          ✓
        </button>
      </div>
      {(item.tip || item.memo || linkedPlace || linkingPlace || linking) && (
        <div className="bucket-photo-foot">
          {item.tip && <div style={{ whiteSpace: 'pre-wrap', color: 'var(--ink)', fontSize: 13, lineHeight: 1.5 }}>💡 {item.tip}</div>}
          {item.memo && <div style={{ whiteSpace: 'pre-wrap', color: 'var(--ink)', fontSize: 13, lineHeight: 1.5 }}>📝 {item.memo}</div>}
          {linkedPlace && <PlaceMeta place={linkedPlace} />}
          {linkingPlace && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <Select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
                <option value="">— 장소 선택 —</option>
                {places.map((p) => <option key={p.id} value={p.id}>[{p.category}] {p.name}</option>)}
              </Select>
              <button className="btn small primary" onClick={linkPlace}>연결</button>
              <button className="btn small" onClick={() => setLinkingPlace(false)}>취소</button>
            </div>
          )}
          {linking && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <Select value={tripId} onChange={(e) => setTripId(e.target.value)}>
                <option value="">— 여행 선택 —</option>
                {trips.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
              <button className="btn small primary" onClick={link}>연결</button>
              <button className="btn small" onClick={() => setLinking(false)}>취소</button>
            </div>
          )}
        </div>
      )}
    </div>
    {editing && (
      <Modal title={`${KIND_EMOJI[kind]} ${item.title}`} onClose={() => setEditing(false)}>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>{kind === 'food' ? '💡 특징 · 알아야 할 TIP' : '💡 알아야 할 TIP'}</label>
          <textarea
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            placeholder={
              kind === 'food'
                ? '예: 오사카식은 국물이 진해요 · 웨이팅 김 · 예약 필수'
                : kind === 'wish'
                  ? '예: 면세 되는지 확인 · 공항보다 시내가 쌈'
                  : '예: 오전에 가야 한산함 · 예약 필요'
            }
            rows={3}
            style={{ width: '100%' }}
          />
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>📝 느낀점</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="다녀온 뒤 느낌, 다음에 참고할 점"
            rows={3}
            style={{ width: '100%' }}
          />
        </div>
        <button className="btn primary" onClick={saveNotes}>저장</button>
      </Modal>
    )}
    </>
  )
}
