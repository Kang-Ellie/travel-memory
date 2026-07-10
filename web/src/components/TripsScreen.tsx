import { useEffect, useState } from 'react'
import type { Trip, Member, Country, City } from '../../shared/types'
import { api } from '../api'
import { fmtMoney } from '../settlement'
import { flagEmoji, tripCitiesLabel } from '../categories'
import Window from './Window'
import Modal from './Modal'
import Select from './Select'
import DatePicker from './DatePicker'

function fmtRange(t: Trip): string {
  const s = new Date(t.startDate + 'T00:00:00')
  const e = new Date(t.endDate + 'T00:00:00')
  const f = (d: Date) => `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
  const nights = Math.round((e.getTime() - s.getTime()) / 86_400_000)
  return `${f(s)} ~ ${f(e)} (${nights}박 ${nights + 1}일)`
}

function dday(t: Trip): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const s = new Date(t.startDate + 'T00:00:00')
  const e = new Date(t.endDate + 'T00:00:00')
  if (today < s) return `D-${Math.round((s.getTime() - today.getTime()) / 86_400_000)}`
  if (today <= e) return '여행 중! ✈️'
  return '다녀옴 💝'
}

export default function TripsScreen({ onOpenTrip }: { onOpenTrip: (t: Trip) => void }) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [selMembers, setSelMembers] = useState<Set<string>>(new Set())
  const [newMemberName, setNewMemberName] = useState('')
  const [selCountryId, setSelCountryId] = useState('')
  const [selCityIds, setSelCityIds] = useState<Set<string>>(new Set())

  const refresh = () => {
    api.trips.list().then(setTrips)
    api.members.list().then(setMembers)
    api.countries.list().then(setCountries)
    api.cities.list().then(setCities)
  }
  useEffect(refresh, [])

  const citiesOfSelCountry = cities.filter((c) => c.countryId === selCountryId)

  const create = async () => {
    if (!title.trim() || !startDate || !endDate) return
    if (endDate < startDate) {
      alert('종료일이 시작일보다 빠를 수 없어요.')
      return
    }
    await api.trips.create({
      title: title.trim(), startDate, endDate,
      budget: parseFloat(budget) || 0, memberIds: [...selMembers], cityIds: [...selCityIds],
    })
    setTitle(''); setStartDate(''); setEndDate(''); setBudget(''); setSelMembers(new Set())
    setSelCountryId(''); setSelCityIds(new Set()); setCreating(false)
    refresh()
  }

  const addMember = async () => {
    if (!newMemberName.trim()) return
    const res = await api.members.create(newMemberName.trim())
    setNewMemberName('')
    if ('error' in res) { alert(res.error); return }
    setSelMembers((prev) => new Set(prev).add(res.id))
    api.members.list().then(setMembers)
  }

  const remove = async (t: Trip) => {
    if (!confirm(`'${t.title}' 여행을 삭제할까요?\n동선·가계부·바우처 기록이 모두 사라집니다.`)) return
    await api.trips.delete(t.id)
    refresh()
  }

  return (
    <div>
      <div className="hero">
        <span className="badge">💾 OUR TRIPS · PRIVATE DB</span>
        <h1>TRAVEL ON</h1>
        <p style={{ fontWeight: 700 }}>우리끼리 쓰는 여행 기록장 — 동선, 솔직 리뷰, 정산까지 한 곳에.</p>
        <button className="btn primary" onClick={() => setCreating((v) => !v)}>
          {creating ? '닫기' : '＋ 새 여행 만들기'}
        </button>
      </div>

      {creating && (
        <Modal title="NEW_TRIP.EXE" onClose={() => setCreating(false)}>
          <div className="form-row">
            <div className="field grow">
              <label>여행 이름</label>
              <input type="text" value={title} placeholder="예: 2026 후쿠오카 효도 여행"
                onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>시작일</label>
              <DatePicker value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="field">
              <label>종료일</label>
              <DatePicker value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="field">
              <label>예산 (원, 선택)</label>
              <input type="number" value={budget} min={0} placeholder="예: 1500000"
                onChange={(e) => setBudget(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>어디로? (국가 · 도시, 선택)</label>
            {countries.length === 0 ? (
              <span className="muted">🌍 국가·도시 화면에서 나라를 먼저 등록하면 여기서 골라 연결할 수 있어요.</span>
            ) : (
              <>
                <Select value={selCountryId} onChange={(e) => setSelCountryId(e.target.value)}>
                  <option value="">— 국가 선택 —</option>
                  {countries.map((c) => <option key={c.id} value={c.id}>{flagEmoji(c.code)} {c.name}</option>)}
                </Select>
                {selCountryId && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                    {citiesOfSelCountry.length === 0 ? (
                      <span className="muted">이 나라엔 등록된 도시가 없어요.</span>
                    ) : citiesOfSelCountry.map((c) => (
                      <label key={c.id} style={{ fontWeight: 700, display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input type="checkbox" checked={selCityIds.has(c.id)}
                          onChange={(e) => {
                            const next = new Set(selCityIds)
                            e.target.checked ? next.add(c.id) : next.delete(c.id)
                            setSelCityIds(next)
                          }} />
                        {c.name}
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>함께 가는 사람</label>
            {members.length > 0 && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                {members.map((m) => (
                  <label key={m.id} style={{ fontWeight: 700, display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selMembers.has(m.id)}
                      onChange={(e) => {
                        const next = new Set(selMembers)
                        e.target.checked ? next.add(m.id) : next.delete(m.id)
                        setSelMembers(next)
                      }}
                    />
                    {m.name}
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={newMemberName} placeholder="새 동행인 이름 (예: 엄마)"
                onChange={(e) => setNewMemberName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMember()} />
              <button className="btn small" onClick={addMember}>＋ 추가</button>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={create}>여행 만들기 ✈️</button>
          </div>
        </Modal>
      )}

      {trips.length === 0 && !creating && (
        <div className="empty">아직 여행이 없어요. 첫 여행을 만들어보세요! 🧳</div>
      )}

      <div className="grid">
        {trips.map((t) => (
          <Window
            key={t.id}
            title={`TRIP_${t.title.replace(/\s+/g, '_').toUpperCase()}`}
            color="pink"
            onClose={() => remove(t)}
            footer={
              <div className="card-footer">
                <span>🧳 {dday(t)}</span>
                <button className="open-link" onClick={() => onOpenTrip(t)}>OPEN →</button>
              </div>
            }
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 19 }}>{t.title}</h3>
            <div style={{ fontWeight: 700 }}>{fmtRange(t)}</div>
            {t.cities.length > 0 && <div className="muted" style={{ marginTop: 4 }}>{tripCitiesLabel(t)}</div>}
            {t.budget > 0 && <div className="muted" style={{ marginTop: 4 }}>💰 예산 {fmtMoney(t.budget, 'KRW')}</div>}
          </Window>
        ))}
      </div>
    </div>
  )
}
