import { useEffect, useRef, useState } from 'react'
import type { Trip, Voucher } from '../../shared/types'
import { api, fileUrl } from '../api'

const ICONS: Record<string, string> = {
  PDF: '📄', PNG: '🖼', JPG: '🖼', JPEG: '🖼', HEIC: '🖼', WEBP: '🖼',
}

export default function VouchersTab({ trip }: { trip: Trip }) {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = () => { api.vouchers.list(trip.id).then(setVouchers) }
  useEffect(refresh, [trip.id])

  const onFilesPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    await api.vouchers.add(trip.id, files)
    refresh()
  }

  return (
    <div>
      <input ref={fileInput} type="file" multiple accept=".pdf,image/*" hidden onChange={onFilesPicked} />
      <button className="btn primary" onClick={() => fileInput.current?.click()}>
        ＋ 파일 추가 (항공권 · 숙소 예약 · 티켓)
      </button>
      <div className="section-gap">
        {vouchers.length === 0 ? (
          <div className="empty">저장된 바우처가 없어요. 항공권 PDF나 예약 확인증을 넣어두면 여행 중에도 바로 열 수 있어요. 🎫</div>
        ) : vouchers.map((v) => (
          <div key={v.id} className="row">
            <span style={{ fontSize: 22 }}>{ICONS[v.fileType] ?? '📎'}</span>
            <div className="grow">
              <div style={{ fontWeight: 800 }}>{v.title}</div>
              <div className="muted">{v.fileType} · {v.createdAt.slice(0, 10)} 저장됨</div>
            </div>
            <a className="btn small" href={fileUrl(v.filePath)} target="_blank" rel="noreferrer">열기</a>
            <button className="btn small ghost" onClick={() => {
              if (confirm(`'${v.title}' 파일을 삭제할까요?`)) api.vouchers.delete(v.id).then(refresh)
            }}>×</button>
          </div>
        ))}
      </div>
    </div>
  )
}
