import { useEffect, useRef, useState } from 'react'
import type { Trip, Voucher } from '../../shared/types'
import { VOUCHER_CATEGORIES } from '../../shared/types'
import { api, fileUrl } from '../api'
import { useUploadProgress } from '../useUploadProgress'
import Select from './Select'
import UploadProgressBar from './UploadProgressBar'

const ICONS: Record<string, string> = {
  PDF: '📄', PNG: '🖼', JPG: '🖼', JPEG: '🖼', HEIC: '🖼', WEBP: '🖼',
}

function VoucherGroup({ cat, items, onRemove }: { cat: string; items: Voucher[]; onRemove: (v: Voucher) => void }) {
  return (
    <div>
      <strong>{cat}</strong>
      {items.map((v) => (
        <div key={v.id} className="row" style={{ marginTop: 8 }}>
          <span style={{ fontSize: 22 }}>{ICONS[v.fileType] ?? '📎'}</span>
          <div className="grow">
            <div style={{ fontWeight: 800 }}>{v.title}</div>
            <div className="muted">{v.fileType} · {v.createdAt.slice(0, 10)} 저장됨</div>
          </div>
          <a className="btn small" href={fileUrl(v.filePath)} target="_blank" rel="noreferrer">열기</a>
          <button className="x-btn" onClick={() => onRemove(v)}>×</button>
        </div>
      ))}
    </div>
  )
}

export default function VouchersTab({ trip }: { trip: Trip }) {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [uploadCategory, setUploadCategory] = useState<string>(VOUCHER_CATEGORIES[0])
  const fileInput = useRef<HTMLInputElement>(null)
  const { uploading, progress, run } = useUploadProgress()

  const refresh = () => { api.vouchers.list(trip.id).then(setVouchers) }
  useEffect(refresh, [trip.id])

  const onFilesPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    await run((onProgress) => api.vouchers.add(trip.id, files, uploadCategory, onProgress))
    refresh()
  }

  const remove = (v: Voucher) => {
    if (confirm(`'${v.title}' 파일을 삭제할까요?`)) api.vouchers.delete(v.id).then(refresh)
  }

  return (
    <div>
      <input ref={fileInput} type="file" multiple accept=".pdf,image/*" hidden onChange={onFilesPicked} />
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="field">
          <label>분류</label>
          <Select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
            {VOUCHER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <button className="btn primary" onClick={() => fileInput.current?.click()} disabled={uploading}>
          {uploading ? '업로드 중…' : `＋ ${uploadCategory} 파일 추가`}
        </button>
      </div>
      {uploading && <UploadProgressBar progress={progress} />}

      {vouchers.length === 0 ? (
        <div className="empty">저장된 바우처가 없어요. 항공권 PDF나 예약 확인증을 넣어두면 여행 중에도 바로 열 수 있어요. 🎫</div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {VOUCHER_CATEGORIES.map((cat) => {
            const items = vouchers.filter((v) => v.category === cat)
            if (items.length === 0) return null
            return <VoucherGroup key={cat} cat={cat} items={items} onRemove={remove} />
          })}
        </div>
      )}
    </div>
  )
}
