import { useState } from 'react'
import type { DayNote, TripCity } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import Modal from './Modal'

const WEATHER_EMOJIS = ['☀️', '🌤', '⛅', '☁️', '🌧', '⛈', '❄️', '🌫', '💨']

export default function DayNoteEditModal({
  tripId, dayNumber, note, cities, onClose, onSaved,
}: {
  tripId: string; dayNumber: number; note: DayNote | null; cities: TripCity[]
  onClose: () => void; onSaved: () => void
}) {
  const [text, setText] = useState(note?.note ?? '')
  const [diary, setDiary] = useState(note?.diary ?? '')
  const [weatherEmoji, setWeatherEmoji] = useState(note?.weatherEmoji ?? '')
  const [weatherTemp, setWeatherTemp] = useState(note?.weatherTemp != null ? String(note.weatherTemp) : '')
  const [cityIds, setCityIds] = useState<Set<string>>(new Set(note?.cityIds ?? []))
  const [budget, setBudget] = useState(note?.budget != null ? String(note.budget) : '')

  const toggleCity = (id: string) => {
    setCityIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const save = async () => {
    const temp = weatherTemp.trim() === '' ? null : Number(weatherTemp)
    const budgetNum = budget.trim() === '' ? null : Number(budget)
    await api.dayNotes.set(tripId, dayNumber, {
      note: text.trim() || null,
      diary: diary.trim() || null,
      weatherEmoji: weatherEmoji || null,
      weatherTemp: temp != null && !Number.isNaN(temp) ? temp : null,
      cityIds: [...cityIds],
      budget: budgetNum != null && !Number.isNaN(budgetNum) ? budgetNum : null,
    })
    onSaved()
    onClose()
  }

  return (
    <Modal title="오늘의 기록" onClose={onClose}>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-start', border: 'none', padding: 0, margin: 0 }}>
        {cities.length > 0 && (
          <div className="field" style={{ width: '100%' }}>
            <label>🌆 오늘 있는 도시 (여러 곳 선택 가능)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {cities.map((c) => (
                <label key={c.id} className={`pill ${cityIds.has(c.id) ? 'active' : ''}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={cityIds.has(c.id)} onChange={() => toggleCity(c.id)} style={{ margin: 0 }} />
                  {flagEmoji(c.countryCode)} {c.countryName} · {c.name}
                </label>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
              💡 도시가 여러 곳이면 날씨는 대표 도시 기준으로만 남기고, 나머지는 아래 "오늘은 어떤 날?"이나 일기에
              자유롭게 적어주세요 (예: "오전 후쿠오카 맑음, 오후 벳푸 흐림"). 도시별로 날씨를 따로 관리하기엔
              수동 입력이라 오히려 번거로워요.
            </p>
          </div>
        )}
        <div className="field">
          <label>💰 하루 예산 (선택, 원)</label>
          <input type="number" value={budget} placeholder="예: 150000" style={{ width: 140 }}
            onChange={(e) => setBudget(e.target.value)} />
        </div>
        <div className="field">
          <label>오늘의 날씨</label>
          <div className="emoji-pick-row">
            {WEATHER_EMOJIS.map((e) => (
              <button key={e} type="button" className={`emoji-pick ${weatherEmoji === e ? 'active' : ''}`}
                onClick={() => setWeatherEmoji(weatherEmoji === e ? '' : e)}>{e}</button>
            ))}
            <input type="number" value={weatherTemp} placeholder="온도(°C)" style={{ width: 90 }}
              onChange={(e) => setWeatherTemp(e.target.value)} />
          </div>
        </div>
        <div className="field grow" style={{ minWidth: 220 }}>
          <label>오늘은 어떤 날?</label>
          <input type="text" value={text} placeholder="예: 느긋하게 시작하는 첫날" onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="field" style={{ width: '100%' }}>
          <label>오늘의 일기</label>
          <textarea value={diary} placeholder="오늘 하루를 조금 더 길게 남겨보세요."
            onChange={(e) => setDiary(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn small primary" onClick={save}>저장</button>
          <button className="btn small" onClick={onClose} style={{ marginLeft: 6 }}>취소</button>
        </div>
      </div>
    </Modal>
  )
}
