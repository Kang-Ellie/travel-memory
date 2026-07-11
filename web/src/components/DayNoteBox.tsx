import { useEffect, useState } from 'react'
import type { DayNote, TripCity } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import { dailyBudgetStatus, fmtMoney } from '../settlement'
import Modal from './Modal'

const WEATHER_EMOJIS = ['☀️', '🌤', '⛅', '☁️', '🌧', '⛈', '❄️', '🌫', '💨']

export default function DayNoteBox({
  tripId, dayNumber, cities, spend, onChanged,
}: { tripId: string; dayNumber: number; cities: TripCity[]; spend: number; onChanged?: () => void }) {
  const [note, setNote] = useState<DayNote | null>(null)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [diary, setDiary] = useState('')
  const [weatherEmoji, setWeatherEmoji] = useState('')
  const [weatherTemp, setWeatherTemp] = useState('')
  const [cityIds, setCityIds] = useState<Set<string>>(new Set())
  const [budget, setBudget] = useState('')
  const [diaryHidden, setDiaryHidden] = useState(true)

  useEffect(() => {
    setEditing(false)
    setDiaryHidden(true)
    api.dayNotes.list(tripId).then((notes) => {
      const n = notes.find((x) => x.dayNumber === dayNumber) ?? null
      setNote(n)
      setText(n?.note ?? '')
      setDiary(n?.diary ?? '')
      setWeatherEmoji(n?.weatherEmoji ?? '')
      setWeatherTemp(n?.weatherTemp != null ? String(n.weatherTemp) : '')
      setCityIds(new Set(n?.cityIds ?? []))
      setBudget(n?.budget != null ? String(n.budget) : '')
    })
  }, [tripId, dayNumber])

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
    const data = {
      note: text.trim() || null,
      diary: diary.trim() || null,
      weatherEmoji: weatherEmoji || null,
      weatherTemp: temp != null && !Number.isNaN(temp) ? temp : null,
      cityIds: [...cityIds],
      budget: budgetNum != null && !Number.isNaN(budgetNum) ? budgetNum : null,
    }
    await api.dayNotes.set(tripId, dayNumber, data)
    setNote({ tripId, dayNumber, ...data })
    setEditing(false)
    onChanged?.()
  }

  const notedCities = (note?.cityIds ?? []).map((id) => cities.find((c) => c.id === id)).filter((c): c is TripCity => !!c)
  const status = dailyBudgetStatus(spend, note?.budget ?? null)

  if (editing) {
    return (
      <Modal title="오늘의 기록" onClose={() => setEditing(false)}>
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
            <button className="btn small" onClick={() => setEditing(false)} style={{ marginLeft: 6 }}>취소</button>
          </div>
        </div>
      </Modal>
    )
  }

  const empty = !note?.note && !note?.diary && !note?.weatherEmoji && notedCities.length === 0 && note?.budget == null
  return (
    <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', background: empty ? undefined : 'var(--yellow-soft)' }}>
      <div className="row" style={{ border: 'none', margin: 0, padding: 0, background: 'none' }}>
        <div className="grow">
          {empty ? (
            <span className="muted">이 날에 대한 메모가 없어요 — 하루 예산이나 날씨, 그날의 한 줄을 남겨보세요.</span>
          ) : (
            <>
              {notedCities.map((c) => (
                <span key={c.id} className="chip purple" style={{ marginRight: 8 }}>
                  {flagEmoji(c.countryCode)} {c.countryName} · {c.name}
                </span>
              ))}
              {note?.weatherEmoji && (
                <span className="chip yellow" style={{ marginRight: 8 }}>
                  {note.weatherEmoji}{note.weatherTemp != null ? ` ${note.weatherTemp}°` : ''}
                </span>
              )}
              {note?.note && <span style={{ fontWeight: 700 }}>{note.note}</span>}
            </>
          )}
        </div>
        <button className="btn small" onClick={() => setEditing(true)}>수정</button>
      </div>
      {note?.budget != null && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            <span>💰 {fmtMoney(spend, 'KRW')} / {fmtMoney(note.budget, 'KRW')}</span>
            {status && <span>{status.emoji} {status.label}</span>}
          </div>
          <div className="meter">
            <div className="meter-track">
              <div className="meter-fill" style={{
                width: `${Math.min(status?.percent ?? 0, 100)}%`,
                background: (status?.percent ?? 0) > 100 ? '#d03b3b' : (status?.percent ?? 0) > 70 ? '#fab219' : '#2a78d6',
              }} />
            </div>
          </div>
        </div>
      )}
      {note?.diary && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1.5px solid rgba(45,42,62,0.15)' }}>
          <div className="muted" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="grow">📔 오늘의 일기</span>
            <button className="btn small ghost" onClick={() => setDiaryHidden((v) => !v)}>
              {diaryHidden ? '보기' : '숨기기'}
            </button>
          </div>
          {!diaryHidden && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{note.diary}</p>}
        </div>
      )}
    </div>
  )
}
