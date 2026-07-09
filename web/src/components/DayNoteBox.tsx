import { useEffect, useState } from 'react'
import type { DayNote } from '../../shared/types'
import { api } from '../api'

export default function DayNoteBox({ tripId, dayNumber }: { tripId: string; dayNumber: number }) {
  const [note, setNote] = useState<DayNote | null>(null)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [weather, setWeather] = useState('')

  useEffect(() => {
    setEditing(false)
    api.dayNotes.list(tripId).then((notes) => {
      const n = notes.find((x) => x.dayNumber === dayNumber) ?? null
      setNote(n)
      setText(n?.note ?? '')
      setWeather(n?.weather ?? '')
    })
  }, [tripId, dayNumber])

  const save = async () => {
    await api.dayNotes.set(tripId, dayNumber, { note: text.trim() || null, weather: weather.trim() || null })
    setNote({ tripId, dayNumber, note: text.trim() || null, weather: weather.trim() || null })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--yellow-soft)' }}>
        <div className="field" style={{ minWidth: 120 }}>
          <label>오늘의 날씨</label>
          <input type="text" value={weather} placeholder="예: 맑음 25도" onChange={(e) => setWeather(e.target.value)} />
        </div>
        <div className="field grow">
          <label>오늘은 어떤 날?</label>
          <input type="text" value={text} placeholder="예: 느긋하게 시작하는 첫날" onChange={(e) => setText(e.target.value)} />
        </div>
        <button className="btn small primary" onClick={save}>저장</button>
        <button className="btn small" onClick={() => setEditing(false)}>취소</button>
      </div>
    )
  }

  const empty = !note?.note && !note?.weather
  return (
    <div className="row" style={{ background: empty ? undefined : 'var(--yellow-soft)' }}>
      <div className="grow">
        {empty ? (
          <span className="muted">이 날에 대한 메모가 없어요 — 날씨나 그날의 한 줄을 남겨보세요.</span>
        ) : (
          <>
            {note?.weather && <span className="chip yellow" style={{ marginRight: 8 }}>☁️ {note.weather}</span>}
            {note?.note && <span style={{ fontWeight: 700 }}>{note.note}</span>}
          </>
        )}
      </div>
      <button className="btn small" onClick={() => setEditing(true)}>수정</button>
    </div>
  )
}
