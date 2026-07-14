import { useEffect, useState } from 'react'
import type { ArchiveItem, Place, GooglePlaceResult } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import Window from './Window'
import Modal from './Modal'
import Select from './Select'

function LinkPlaceModal({
  item, places, onClose, onLinked,
}: { item: ArchiveItem; places: Place[]; onClose: () => void; onLinked: () => void }) {
  const [mode, setMode] = useState<'existing' | 'search'>(places.length > 0 ? 'existing' : 'search')
  const [existingId, setExistingId] = useState('')
  const [query, setQuery] = useState(item.title)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<GooglePlaceResult[]>([])
  const [searchError, setSearchError] = useState('')

  const linkExisting = async () => {
    if (!existingId) return
    await api.archive.linkPlace(item.id, existingId)
    onLinked()
  }

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

  const saveAndLink = async (r: GooglePlaceResult) => {
    const p = await api.places.create({ name: r.name, address: r.address, category: '기타', lat: r.lat, lng: r.lng })
    await api.archive.linkPlace(item.id, p.id)
    onLinked()
  }

  return (
    <Modal title="장소로 만들기" onClose={onClose}>
      <div className="day-tabs" style={{ marginBottom: 16 }}>
        {places.length > 0 && (
          <button className={`pill ${mode === 'existing' ? 'active' : ''}`} onClick={() => setMode('existing')}>
            📍 이미 있는 장소예요
          </button>
        )}
        <button className={`pill ${mode === 'search' ? 'active' : ''}`} onClick={() => setMode('search')}>
          🔍 새로 찾을게요
        </button>
      </div>

      {mode === 'existing' ? (
        <div className="row" style={{ border: 'none', padding: 0, margin: 0 }}>
          <Select value={existingId} onChange={(e) => setExistingId(e.target.value)}>
            <option value="">— 기존 장소에서 선택 —</option>
            {places.map((p) => <option key={p.id} value={p.id}>[{p.category}] {p.name}</option>)}
          </Select>
          <button className="btn small primary" onClick={linkExisting} disabled={!existingId}>연결</button>
        </div>
      ) : (
        <>
          <div className="form-row">
            <div className="field grow">
              <label>구글에서 장소 검색</label>
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="장소명" />
            </div>
            <button className="btn primary" onClick={search} disabled={searching}>{searching ? '검색 중…' : '🔍 검색'}</button>
          </div>
          {searchError && <div className="error-text">{searchError}</div>}
          {results.map((r, i) => (
            <div key={i} className="row">
              <span className="chip green">{r.category}</span>
              <div className="grow">
                <div style={{ fontWeight: 800 }}>{r.name}</div>
                <div className="muted">{r.address}</div>
              </div>
              <button className="btn small primary" onClick={() => saveAndLink(r)}>저장하고 연결</button>
            </div>
          ))}
        </>
      )}
    </Modal>
  )
}

function SnsCard({ item, places, onChanged }: { item: ArchiveItem; places: Place[]; onChanged: () => void }) {
  const [linking, setLinking] = useState(false)
  const linkedPlace = item.linkedPlaceId ? places.find((p) => p.id === item.linkedPlaceId) : undefined

  const unlink = async () => {
    await api.archive.linkPlace(item.id, null)
    onChanged()
  }
  const remove = async () => {
    if (!confirm('이 링크를 삭제할까요?')) return
    await api.archive.delete(item.id)
    onChanged()
  }

  return (
    <div className="row" style={{ flexWrap: 'wrap' }}>
      <span style={{ fontSize: 20 }}>🔗</span>
      <div className="grow">
        <div style={{ fontWeight: 800 }}>{item.title}</div>
        {item.body && (
          <a className="muted" href={item.body} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>
            {item.body}
          </a>
        )}
        {item.linkedPlaceId && (
          <div className="muted" style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>📍 연결된 장소: <strong>{item.linkedPlaceName}</strong></span>
            {linkedPlace?.countryName && (
              <span className="chip purple">
                {flagEmoji(linkedPlace.countryCode)} {linkedPlace.countryName}{linkedPlace.cityName ? ` · ${linkedPlace.cityName}` : ''}
              </span>
            )}
            <button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={unlink}>연결 해제</button>
          </div>
        )}
      </div>
      {!item.linkedPlaceId && (
        <button className="btn small" onClick={() => setLinking(true)}>📍 장소로 만들기</button>
      )}
      <button className="x-btn" onClick={remove}>×</button>
      {linking && (
        <LinkPlaceModal
          item={item}
          places={places}
          onClose={() => setLinking(false)}
          onLinked={() => { setLinking(false); onChanged() }}
        />
      )}
    </div>
  )
}

export default function SnsArchiveScreen({
  prefill, onConsumedPrefill,
}: { prefill?: { title: string; url: string } | null; onConsumedPrefill?: () => void }) {
  const [items, setItems] = useState<ArchiveItem[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')

  const refresh = () => {
    api.archive.listGlobal().then(setItems)
    api.places.list().then(setPlaces)
  }
  useEffect(refresh, [])

  useEffect(() => {
    if (!prefill) return
    setTitle(prefill.title)
    setUrl(prefill.url)
    setShowAdd(true)
    onConsumedPrefill?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill])

  const add = async () => {
    if (!url.trim()) return
    await api.archive.addLinkGlobal({ title: title.trim(), url: url.trim() })
    setTitle(''); setUrl('')
    setShowAdd(false)
    refresh()
  }

  return (
    <div>
      <Window title="SNS_ARCHIVE.EXE" color="purple">
        <p className="muted" style={{ marginTop: 0 }}>
          인스타·유튜브 등에서 본 맛집·장소 링크를 여행과 상관없이 여기 모아두세요. 나중에 "장소로 만들기"를 누르면
          우리 장소 족보에 등록되고, 그때부터 어느 여행에든 자유롭게 넣을 수 있어요. 한 곳을 여러 번 갈 수도 있으니까요.
        </p>
        <button className="btn primary" onClick={() => setShowAdd(true)}>＋ 링크 추가</button>
      </Window>

      {showAdd && (
        <Modal title="링크 추가" onClose={() => setShowAdd(false)}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>제목 (선택)</label>
            <input type="text" value={title} placeholder="예: 후쿠오카 멘타이쥬"
              onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>링크</label>
            <input type="text" value={url} placeholder="https://..." onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()} />
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={add}>저장</button>
          </div>
        </Modal>
      )}

      <Window title="SAVED_LINKS.EXE" color="green">
        {items.length === 0 ? (
          <div className="empty">아직 저장된 링크가 없어요.</div>
        ) : items.map((item) => <SnsCard key={item.id} item={item} places={places} onChanged={refresh} />)}
      </Window>
    </div>
  )
}
