import { useRef, useState } from 'react'
import type { DayNote } from '../../shared/types'
import { api, fileUrl } from '../api'
import Modal from './Modal'
import Lightbox from './Lightbox'

export default function DayDiaryModal({
  tripId, dayNumber, note, onClose, onChanged, onEdit,
}: {
  tripId: string; dayNumber: number; note: DayNote | null
  onClose: () => void; onChanged: () => void; onEdit: () => void
}) {
  const [diary, setDiary] = useState(note?.diary ?? '')
  const [saving, setSaving] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const photos = note?.photos ?? []
  const photoUrls = photos.map((p) => fileUrl(p.filePath))

  const onPhotosPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    await api.dayNotes.addPhotos(tripId, dayNumber, files)
    onChanged()
  }

  const saveDiary = async () => {
    setSaving(true)
    await api.dayNotes.set(tripId, dayNumber, {
      note: note?.note ?? null, diary: diary.trim() || null,
      weatherEmoji: note?.weatherEmoji ?? null, weatherTemp: note?.weatherTemp ?? null,
      cityIds: note?.cityIds ?? [], budget: note?.budget ?? null,
    })
    setSaving(false)
    onChanged()
  }

  return (
    <Modal title={`📔 ${dayNumber}일차 오늘의 일기`} onClose={onClose}>
      <div className="day-diary-layout">
        <div className="day-diary-photos-col">
          <input ref={photoInput} type="file" multiple accept="image/*" hidden onChange={onPhotosPicked} />
          {photos.length === 0 ? (
            <div className="empty" style={{ marginBottom: 10 }}>아직 사진이 없어요. 오늘 찍은 사진을 남겨보세요.</div>
          ) : (
            <div className="photo-strip">
              {photos.map((p, i) => (
                <div key={p.id} className="photo-thumb">
                  <img src={fileUrl(p.filePath)} alt="" onClick={() => setLightboxIndex(i)} />
                  <button className="photo-del" title="사진 삭제"
                    onClick={() => api.dayNotes.deletePhoto(p.id).then(onChanged)}>×</button>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="btn small" style={{ marginTop: 10 }} onClick={() => photoInput.current?.click()}>
            📷 사진 추가
          </button>
          {lightboxIndex != null && (
            <Lightbox images={photoUrls} index={lightboxIndex} onClose={() => setLightboxIndex(null)} />
          )}
        </div>
        <div className="day-diary-text-col">
          <textarea
            value={diary}
            placeholder="오늘 하루를 남겨보세요."
            onChange={(e) => setDiary(e.target.value)}
            style={{ width: '100%', minHeight: 220 }}
          />
          <div style={{ marginTop: 10 }}>
            <button className="btn small primary" onClick={saveDiary} disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </button>
            <button className="btn small" onClick={onEdit} style={{ marginLeft: 6 }}>🌤 날씨·예산·도시 수정</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
