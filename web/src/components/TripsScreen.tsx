import { useEffect, useState } from 'react'
import type { Trip } from '../../shared/types'
import { api } from '../api'
import { useTrips, useMembers, useCountries, useCities, useQueryClient, queryKeys } from '../queries'
import Modal from './Modal'
import DatePicker from './DatePicker'
import TripCountryCityPicker from './TripCountryCityPicker'
import PageHeader from './PageHeader'
import TripTicket from './TripTicket'

export function fmtRange(t: Trip): string {
  const s = new Date(t.startDate + 'T00:00:00')
  const e = new Date(t.endDate + 'T00:00:00')
  const f = (d: Date) => `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
  const spanNights = Math.round((e.getTime() - s.getTime()) / 86_400_000)
  // 무박(밤도깨비)·마지막날 심야 출발처럼 날짜 차이와 실제 숙박 수가 다른 경우를 위해
  // 여행 만들 때 직접 입력해둔 nights가 있으면 그걸 우선한다 (TripSummaryCard와 동일 규칙).
  const nights = t.nights ?? spanNights
  return `${f(s)} ~ ${f(e)} (${nights}박 ${nights + 1}일)`
}

export type TripStatus = 'upcoming' | 'ongoing' | 'past'

export function tripStatus(t: Trip): TripStatus {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const s = new Date(t.startDate + 'T00:00:00')
  const e = new Date(t.endDate + 'T00:00:00')
  if (today < s) return 'upcoming'
  if (today <= e) return 'ongoing'
  return 'past'
}

export function dday(t: Trip): string {
  const status = tripStatus(t)
  if (status === 'ongoing') return '여행 중! ✈️'
  if (status === 'past') return '다녀옴 💝'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const s = new Date(t.startDate + 'T00:00:00')
  return `D-${Math.round((s.getTime() - today.getTime()) / 86_400_000)}`
}

export default function TripsScreen({
  onOpenTrip, autoOpenAdd, onConsumedAutoOpenAdd,
}: { onOpenTrip: (t: Trip) => void; autoOpenAdd?: boolean; onConsumedAutoOpenAdd?: () => void }) {
  const { data: trips = [] } = useTrips()
  const { data: members = [] } = useMembers()
  const { data: countries = [] } = useCountries()
  const { data: cities = [] } = useCities()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (autoOpenAdd) { setCreating(true); onConsumedAutoOpenAdd?.() }
  }, [autoOpenAdd])
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [nights, setNights] = useState('')
  const [selMembers, setSelMembers] = useState<Set<string>>(new Set())
  const [newMemberName, setNewMemberName] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)
  const [selCountryIds, setSelCountryIds] = useState<Set<string>>(new Set())
  const [selCityIds, setSelCityIds] = useState<Set<string>>(new Set())

  const create = async () => {
    if (!title.trim() || !startDate || !endDate) return
    if (endDate < startDate) {
      alert('종료일이 시작일보다 빠를 수 없어요.')
      return
    }
    await api.trips.create({
      title: title.trim(), startDate, endDate,
      budget: parseFloat(budget) || 0, nights: nights.trim() ? parseInt(nights) : null,
      memberIds: [...selMembers], cityIds: [...selCityIds],
    })
    setTitle(''); setStartDate(''); setEndDate(''); setBudget(''); setNights(''); setSelMembers(new Set())
    setSelCountryIds(new Set()); setSelCityIds(new Set()); setCreating(false)
    queryClient.invalidateQueries({ queryKey: queryKeys.trips })
  }

  const addMember = async () => {
    const trimmed = newMemberName.trim()
    if (!trimmed) return
    const res = await api.members.create(trimmed)
    setNewMemberName('')
    if ('error' in res) {
      // 이미 같은 이름의 동행인이 있으면 새로 만드는 대신 그 사람을 그냥 선택해준다.
      const existing = members.find((m) => m.name === trimmed)
      if (!existing) { alert(res.error); return }
      setSelMembers((prev) => new Set(prev).add(existing.id))
      setShowAddMember(false)
      return
    }
    setSelMembers((prev) => new Set(prev).add(res.id))
    setShowAddMember(false)
    queryClient.invalidateQueries({ queryKey: queryKeys.members })
  }

  const remove = async (t: Trip) => {
    if (!confirm(`'${t.title}' 여행을 삭제할까요?\n동선·가계부·바우처 기록이 모두 사라집니다.`)) return
    await api.trips.delete(t.id)
    queryClient.invalidateQueries({ queryKey: queryKeys.trips })
  }

  return (
    <div>
      <PageHeader icon="🏝" title="여행" eng="TRIPS"
        description="우리끼리 쓰는 여행 기록장 — 동선, 솔직 리뷰, 정산까지 한 곳에." />
      <div className="row" style={{ border: 'none', padding: 0, background: 'transparent', marginBottom: 18 }}>
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
            <div className="field" style={{ maxWidth: 130 }}>
              <label>몇 박 (선택)</label>
              <input type="number" value={nights} min={0}
                placeholder={
                  startDate && endDate && endDate >= startDate
                    ? `기본 ${Math.round((new Date(endDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime()) / 86_400_000)}박`
                    : '예: 2'
                }
                onChange={(e) => setNights(e.target.value)} />
            </div>
          </div>
          <p className="muted" style={{ margin: '2px 0 0' }}>
            날짜 기준이 아니라 실제 숙박 수예요. 같은 4일이라도 밤도깨비(무박)·마지막날 심야 출발이면 2박으로 적어두면 정확하게 표시돼요.
          </p>
          <div className="field" style={{ marginTop: 12 }}>
            <label>어디로? (국가 · 도시, 선택)</label>
            <TripCountryCityPicker
              countries={countries}
              cities={cities}
              selCountryIds={selCountryIds}
              onSelCountryIdsChange={setSelCountryIds}
              selCityIds={selCityIds}
              onSelCityIdsChange={setSelCityIds}
              onCatalogChanged={() => {
                queryClient.invalidateQueries({ queryKey: queryKeys.countries })
                queryClient.invalidateQueries({ queryKey: queryKeys.cities })
              }}
            />
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
            <button className="btn small" onClick={() => setShowAddMember(true)}>＋ 새 동행인 추가</button>
          </div>

          {showAddMember && (
            <Modal title="새 동행인 추가" onClose={() => setShowAddMember(false)}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={newMemberName} placeholder="이름 (예: 엄마)" autoFocus
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMember()} />
                <button className="btn small primary" onClick={addMember}>＋ 추가</button>
              </div>
            </Modal>
          )}
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
          <TripTicket key={t.id} trip={t} onOpen={() => onOpenTrip(t)} onDelete={() => remove(t)} />
        ))}
      </div>
    </div>
  )
}
