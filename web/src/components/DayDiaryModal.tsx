import { useRef, useState } from 'react'
import type { Trip, DayNote, Expense, CurrencyRate } from '../../shared/types'
import { api, fileUrl } from '../api'
import { flagEmoji } from '../categories'
import { computeDailySpend, dailyBudgetStatus } from '../settlement'
import { dayLabel } from './TripWorkspace'
import Modal from './Modal'
import Lightbox from './Lightbox'

function budgetBarColor(percent: number): string {
  if (percent <= 30) return 'var(--green-deep)'
  if (percent <= 50) return 'var(--blue-deep)'
  if (percent <= 70) return 'var(--yellow-deep)'
  if (percent <= 100) return '#e08a3c'
  return '#d03b3b'
}

export default function DayDiaryModal({
  trip, dayNumber, note, expenses, rates, onClose, onChanged, onEdit,
}: {
  trip: Trip; dayNumber: number; note: DayNote | null
  expenses: Expense[]; rates: CurrencyRate[]
  onClose: () => void; onChanged: () => void; onEdit: () => void
}) {
  const [diary, setDiary] = useState(note?.diary ?? '')
  const [saving, setSaving] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const photos = note?.photos ?? []
  const photoUrls = photos.map((p) => fileUrl(p.filePath))
  const cover = photos[0] ?? null
  const restPhotos = photos.slice(1)

  const onPhotosPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    await api.dayNotes.addPhotos(trip.id, dayNumber, files)
    onChanged()
  }

  const saveDiary = async () => {
    setSaving(true)
    await api.dayNotes.set(trip.id, dayNumber, {
      note: note?.note ?? null, diary: diary.trim() || null,
      weatherEmoji: note?.weatherEmoji ?? null, weatherTemp: note?.weatherTemp ?? null,
      cityIds: note?.cityIds ?? [], budget: note?.budget ?? null,
    })
    setSaving(false)
    onChanged()
  }

  const cities = trip.cities.filter((c) => (note?.cityIds ?? []).includes(c.id))
  const spend = computeDailySpend(trip, expenses, dayNumber, rates).total
  const status = dailyBudgetStatus(spend, note?.budget ?? null)

  return (
    <Modal title={`📔 ${dayNumber}일차 오늘의 일기`} onClose={onClose}>
      <input ref={photoInput} type="file" multiple accept="image/*" hidden onChange={onPhotosPicked} />

      <div className="diary-cover-wrap">
        {cover ? (
          <>
            <img className="diary-cover" src={fileUrl(cover.filePath)} alt="" onClick={() => setLightboxIndex(0)} />
            <button className="photo-del" title="사진 삭제"
              onClick={() => api.dayNotes.deletePhoto(cover.id).then(onChanged)}>×</button>
          </>
        ) : (
          <button type="button" className="diary-cover-empty" onClick={() => photoInput.current?.click()}>
            📷 대표 사진 추가
          </button>
        )}
      </div>

      <div className="diary-meta">
        <div className="diary-title">{dayNumber}일차 · {note?.note || '오늘 하루'}</div>
        <div className="diary-sub-row">
          <span>{dayLabel(trip, dayNumber)}</span>
          {note?.weatherEmoji && (
            <span className="chip yellow">{note.weatherEmoji}{note.weatherTemp != null ? ` ${note.weatherTemp}°` : ''}</span>
          )}
        </div>
        {cities.length > 0 && (
          <div className="diary-chips">
            {cities.map((c) => (
              <span key={c.id} className="chip purple">{flagEmoji(c.countryCode)} {c.countryName} · {c.name}</span>
            ))}
          </div>
        )}
        {status && (
          <div className="diary-budget">
            <div className="diary-budget-track">
              <div className="diary-budget-fill" style={{ width: `${Math.min(status.percent, 100)}%`, background: budgetBarColor(status.percent) }} />
            </div>
            <div className="diary-budget-label">{status.emoji} {status.label} · {Math.round(status.percent)}%</div>
          </div>
        )}
      </div>

      {restPhotos.length > 0 && (
        <div className="photo-strip">
          {restPhotos.map((p, i) => (
            <div key={p.id} className="photo-thumb">
              <img src={fileUrl(p.filePath)} alt="" onClick={() => setLightboxIndex(i + 1)} />
              <button className="photo-del" title="사진 삭제"
                onClick={() => api.dayNotes.deletePhoto(p.id).then(onChanged)}>×</button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="btn small" style={{ marginTop: 10 }} onClick={() => photoInput.current?.click()}>
        📷 사진 추가
      </button>

      <div style={{ marginTop: 16 }}>
        <textarea
          value={diary}
          placeholder="오늘 하루를 남겨보세요."
          onChange={(e) => setDiary(e.target.value)}
          style={{ width: '100%', minHeight: 160 }}
        />
        <div style={{ marginTop: 10 }}>
          <button className="btn small primary" onClick={saveDiary} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
          <button className="btn small" onClick={onEdit} style={{ marginLeft: 6 }}>🌤 날씨·예산·도시 수정</button>
        </div>
      </div>

      {lightboxIndex != null && (
        <Lightbox images={photoUrls} index={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </Modal>
  )
}
