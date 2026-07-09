import { useEffect, useState } from 'react'
import type { DayNote } from '../../shared/types'
import { api } from '../api'

const WEATHER_EMOJIS = ['☀️', '🌤', '⛅', '☁️', '🌧', '⛈', '❄️', '🌫', '💨']

export default function DayNoteBox({ tripId, dayNumber }: { tripId: string; dayNumber: number }) {
  const [note, setNote] = useState<DayNote | null>(null)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [diary, setDiary] = useState('')
  const [weatherEmoji, setWeatherEmoji] = useState('')
  const [weatherTemp, setWeatherTemp] = useState('')

  useEffect(() => {
    setEditing(false)
    api.dayNotes.list(tripId).then((notes) => {
      const n = notes.find((x) => x.dayNumber === dayNumber) ?? null
      setNote(n)
      setText(n?.note ?? '')
      setDiary(n?.diary ?? '')
      setWeatherEmoji(n?.weatherEmoji ?? '')
      setWeatherTemp(n?.weatherTemp != null ? String(n.weatherTemp) : '')
    })
  }, [tripId, dayNumber])

  const save = async () => {
    const temp = weatherTemp.trim() === '' ? null : Number(weatherTemp)
    const data = {
      note: text.trim() || null,
      diary: diary.trim() || null,
      weatherEmoji: weatherEmoji || null,
      weatherTemp: temp != null && !Number.isNaN(temp) ? temp : null,
    }
    await api.dayNotes.set(tripId, dayNumber, data)
    setNote({ tripId, dayNumber, ...data })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-start', background: 'var(--yellow-soft)' }}>
        <div className="field" style={{ width: '100%' }}>
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
        <button className="btn small primary" onClick={save}>저장</button>
        <button className="btn small" onClick={() => setEditing(false)}>취소</button>
      </div>
    )
  }

  const empty = !note?.note && !note?.diary && !note?.weatherEmoji
  return (
    <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', background: empty ? undefined : 'var(--yellow-soft)' }}>
      <div className="row" style={{ border: 'none', margin: 0, padding: 0, background: 'none' }}>
        <div className="grow">
          {empty ? (
            <span className="muted">이 날에 대한 메모가 없어요 — 날씨나 그날의 한 줄을 남겨보세요.</span>
          ) : (
            <>
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
      {note?.diary && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1.5px solid rgba(45,42,62,0.15)' }}>
          <div className="muted" style={{ marginBottom: 4 }}>📔 오늘의 일기</div>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{note.diary}</p>
        </div>
      )}
    </div>
  )
}
