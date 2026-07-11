import { useEffect, useState } from 'react'
import type { DayNote, TripCity } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import { dailyBudgetStatus, fmtMoney } from '../settlement'
import Modal from './Modal'

const WEATHER_EMOJIS = ['☀️', '🌤', '⛅', '☁️', '🌧', '⛈', '❄️', '🌫', '💨']

export default function DayNoteBox({
  tripId, dayNumber, dayHeaderText, cities, spend, onChanged,
}: { tripId: string; dayNumber: number; dayHeaderText: string; cities: TripCity[]; spend: number; onChanged?: () => void }) {
  const [note, setNote] = useState<DayNote | null>(null)
  const [editing, setEditing] = useState(false)
  const [diaryOpen, setDiaryOpen] = useState(false)
  const [text, setText] = useState('')
  const [diary, setDiary] = useState('')
  const [weatherEmoji, setWeatherEmoji] = useState('')
  const [weatherTemp, setWeatherTemp] = useState('')
  const [cityIds, setCityIds] = useState<Set<string>>(new Set())
  const [budget, setBudget] = useState('')

  useEffect(() => {
    setEditing(false)
    setDiaryOpen(false)
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
            <button className="btn small" onClick={() => setEditing(false)} style={{ marginLeft: 6 }}>취소</button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', position: 'relative', background: 'var(--pink-soft)' }}>
      <span style={{ position: 'absolute', top: 12, right: 14, fontSize: 20 }}>☘️</span>
      <button className="btn small ghost" style={{ position: 'absolute', top: 10, right: 46 }} onClick={() => setEditing(true)}>
        수정
      </button>

      <div style={{ cursor: 'pointer', paddingRight: 90 }} onClick={() => setDiaryOpen(true)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 16 }}>
          <span>{dayHeaderText}</span>
          {note?.weatherEmoji && <span title={note.weatherTemp != null ? `${note.weatherTemp}°` : undefined}>{note.weatherEmoji}</span>}
        </div>
        {notedCities.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {notedCities.map((c) => (
              <span key={c.id} className="chip purple">{flagEmoji(c.countryCode)} {c.countryName} · {c.name}</span>
            ))}
          </div>
        )}
        {note?.note ? (
          <div style={{ marginTop: 10, fontWeight: 700 }}>{note.note}</div>
        ) : (
          <div className="muted" style={{ marginTop: 10 }}>이 날에 대한 메모가 없어요 — 눌러서 일기를 남겨보세요.</div>
        )}
      </div>

      {note?.budget != null && (
        <div style={{ marginTop: 14 }}>
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

      {diaryOpen && (
        <Modal title={`📔 ${dayHeaderText} 일기`} onClose={() => setDiaryOpen(false)}>
          {note?.diary ? (
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{note.diary}</p>
          ) : (
            <div className="empty">아직 일기가 없어요. [수정]에서 적어보세요.</div>
          )}
        </Modal>
      )}
    </div>
  )
}
