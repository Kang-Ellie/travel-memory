import { useEffect, useRef, useState } from 'react'
import type { ArchiveItem } from '../../shared/types'
import { api, fileUrl } from '../api'
import Lightbox from './Lightbox'
import Modal from './Modal'
import DropdownMenu from './DropdownMenu'

const ICON: Record<ArchiveItem['kind'], string> = { memo: '📝', link: '🔗', image: '🖼' }

export const ARCHIVE_DRAG_TYPE = 'application/x-travel-on-archive'

function ArchiveCard({ item, onChanged }: { item: ArchiveItem; onChanged: () => void }) {
  const [lightbox, setLightbox] = useState(false)
  return (
    <div
      className="archive-card"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ARCHIVE_DRAG_TYPE, item.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <div className="archive-card-head">
        <span>{ICON[item.kind]}</span>
        <span className="archive-card-title">{item.title}</span>
        <button className="x-btn" onClick={() => {
          if (confirm('보관함에서 삭제할까요?')) api.archive.delete(item.id).then(onChanged)
        }}>×</button>
      </div>
      {item.kind === 'image' && item.filePath && (
        <img src={fileUrl(item.filePath)} alt="" onClick={() => setLightbox(true)} />
      )}
      {item.kind === 'link' && item.body && (
        <div className="archive-card-body">🔗 {item.body}</div>
      )}
      {item.kind === 'memo' && item.body && <div className="archive-card-body">{item.body}</div>}
      <div className="muted" style={{ marginTop: 6 }}>👉 왼쪽 동선의 날짜 칸으로 끌어다 놓으면 일정으로 편입돼요.</div>
      {lightbox && item.filePath && (
        <Lightbox images={[fileUrl(item.filePath)]} index={0} onClose={() => setLightbox(false)} />
      )}
    </div>
  )
}

export default function ArchiveBoard({ tripId }: { tripId: string }) {
  const [items, setItems] = useState<ArchiveItem[]>([])
  const [mode, setMode] = useState<'memo' | 'link'>('memo')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = () => { api.archive.list(tripId).then(setItems) }
  useEffect(refresh, [tripId])

  const addMemo = async () => {
    if (!body.trim()) return
    await api.archive.addMemo({ tripId, title: title.trim() || '메모', body })
    setTitle(''); setBody('')
    setShowAdd(false)
    refresh()
  }
  const addLink = async () => {
    if (!body.trim()) return
    await api.archive.addLink({ tripId, title: title.trim(), url: body.trim() })
    setTitle(''); setBody('')
    setShowAdd(false)
    refresh()
  }
  const onImagesPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    await api.archive.addImage(tripId, files)
    refresh()
  }

  return (
    <div className="archive-board">
      <input ref={fileInput} type="file" multiple accept="image/*" hidden onChange={onImagesPicked} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <DropdownMenu icon="＋" title="추가" actions={[
          { label: '📝 메모 추가', onClick: () => { setMode('memo'); setShowAdd(true) } },
          { label: '🔗 링크 추가', onClick: () => { setMode('link'); setShowAdd(true) } },
          { label: '🖼 이미지 추가', onClick: () => fileInput.current?.click() },
        ]} />
      </div>

      {showAdd && (
        <Modal title={mode === 'memo' ? '메모 추가' : '링크 추가'} onClose={() => setShowAdd(false)}>
          <div className="archive-add-tabs">
            <button className={`pill ${mode === 'memo' ? 'active' : ''}`} onClick={() => setMode('memo')}>📝 메모</button>
            <button className={`pill ${mode === 'link' ? 'active' : ''}`} onClick={() => setMode('link')}>🔗 링크</button>
          </div>
          <div className="field" style={{ marginBottom: 6 }}>
            <input type="text" value={title} placeholder={mode === 'memo' ? '제목 (선택)' : '어디서 봤는지 (선택)'}
              onChange={(e) => setTitle(e.target.value)} />
          </div>
          {mode === 'memo' ? (
            <textarea value={body} placeholder="찾아본 정보, 아이디어, 하고 싶은 것 등을 자유롭게 적어두세요."
              onChange={(e) => setBody(e.target.value)} style={{ marginBottom: 8, width: '100%' }} />
          ) : (
            <input type="text" value={body} placeholder="https://..." onChange={(e) => setBody(e.target.value)}
              style={{ marginBottom: 8, width: '100%' }} />
          )}
          <button className="btn primary small" onClick={mode === 'memo' ? addMemo : addLink}>보관함에 저장</button>
        </Modal>
      )}

      <div className="section-gap">
        {items.length === 0 ? (
          <div className="empty">아직 보관된 정보가 없어요. 여행 전 찾아본 맛집·블로그·사진을 여기 모아두세요.</div>
        ) : items.map((it) => <ArchiveCard key={it.id} item={it} onChanged={refresh} />)}
      </div>
    </div>
  )
}
