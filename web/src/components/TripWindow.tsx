import { useEffect, useState } from 'react'
import type { Country, City, Trip } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import Window from './Window'
import Modal from './Modal'
import DatePicker from './DatePicker'
import TripCountryCityPicker from './TripCountryCityPicker'
import TripWorkspace from './TripWorkspace'
import TripBaseSection from './TripBaseSection'
import ExpensesTab from './ExpensesTab'
import VouchersTab from './VouchersTab'
import TripPrepTab from './TripPrepTab'
import FolderIcon, { type FolderColor } from './FolderIcon'

type Tab = 'base' | 'workspace' | 'settlement' | 'vouchers' | 'prep'

const TABS: Array<{ key: Tab; label: string; color: FolderColor }> = [
  { key: 'base', label: 'BASE', color: 'blue' },
  { key: 'workspace', label: '일정 & 지출', color: 'purple' },
  { key: 'settlement', label: '정산', color: 'pink' },
  { key: 'vouchers', label: '바우처', color: 'yellow' },
  { key: 'prep', label: '여행 준비', color: 'green' },
]

interface Props {
  trip: Trip
  onClose: () => void
  onTripChanged: (t: Trip) => void
}

export default function TripWindow({ trip, onClose, onTripChanged }: Props) {
  const [tab, setTab] = useState<Tab>('base')
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(trip.title)
  const [startDate, setStartDate] = useState(trip.startDate)
  const [endDate, setEndDate] = useState(trip.endDate)
  const [budget, setBudget] = useState(String(trip.budget || ''))
  const [selCountryIds, setSelCountryIds] = useState<Set<string>>(new Set())
  const [selCityIds, setSelCityIds] = useState<Set<string>>(new Set(trip.cities.map((c) => c.id)))

  useEffect(() => {
    api.countries.list().then(setCountries)
    api.cities.list().then(setCities)
  }, [])

  const startEdit = () => {
    setTitle(trip.title); setStartDate(trip.startDate); setEndDate(trip.endDate)
    setBudget(String(trip.budget || '')); setSelCityIds(new Set(trip.cities.map((c) => c.id)))
    const tripCountryIds = new Set(
      trip.cities.map((tc) => cities.find((c) => c.id === tc.id)?.countryId).filter((id): id is string => !!id),
    )
    setSelCountryIds(tripCountryIds)
    setEditing(true)
  }

  const save = async () => {
    if (!title.trim() || !startDate || !endDate) return
    await api.trips.update(trip.id, {
      title: title.trim(), startDate, endDate, budget: parseFloat(budget) || 0, cityIds: [...selCityIds],
    })
    const fresh = await api.trips.list()
    const updated = fresh.find((t) => t.id === trip.id)
    if (updated) onTripChanged(updated)
    setEditing(false)
  }

  const citiesByCountry = new Map<string, { code: string | null; name: string; cities: string[] }>()
  for (const c of trip.cities) {
    const entry = citiesByCountry.get(c.countryName) ?? { code: c.countryCode, name: c.countryName, cities: [] }
    entry.cities.push(c.name)
    citiesByCountry.set(c.countryName, entry)
  }

  return (
    <Window
      title={`${trip.title.replace(/\s+/g, '_').toUpperCase()}.EXE`}
      color="blue"
      onClose={onClose}
      headerActions={<button className="window-icon-btn" onClick={startEdit} title="여행 정보 수정">⚙️</button>}
    >
      <div className="row" style={{ flexWrap: 'wrap', border: 'none', padding: 0, background: 'transparent', marginBottom: 12, gap: 12 }}>
        {trip.cities.length > 0 ? (
          [...citiesByCountry.values()].map((c) => (
            <span key={c.name} style={{ fontSize: 13, fontWeight: 700 }}>
              {flagEmoji(c.code)} {c.name} · {c.cities.join(', ')}
            </span>
          ))
        ) : (
          <span style={{ color: 'var(--ink)' }}>🌍 국가·도시가 아직 연결 안 됐어요 — 오른쪽 위 ⚙️에서 등록해보세요.</span>
        )}
      </div>

      {editing && (
        <Modal title="여행 정보 수정" onClose={() => setEditing(false)}>
          <div className="form-row">
            <div className="field grow">
              <label>여행 이름</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
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
              <label>예산 (원)</label>
              <input type="number" value={budget} min={0} onChange={(e) => setBudget(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>어디로? (국가 · 도시)</label>
            <TripCountryCityPicker
              countries={countries}
              cities={cities}
              selCountryIds={selCountryIds}
              onSelCountryIdsChange={setSelCountryIds}
              selCityIds={selCityIds}
              onSelCityIdsChange={setSelCityIds}
              onCatalogChanged={() => { api.countries.list().then(setCountries); api.cities.list().then(setCities) }}
            />
            {selCityIds.size > 0 && (
              <div className="muted" style={{ marginTop: 8 }}>
                선택됨: {[...selCityIds].map((id) => cities.find((c) => c.id === id)?.name).filter(Boolean).join(', ')}
              </div>
            )}
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={save}>저장</button>
            <button className="btn" style={{ marginLeft: 6 }} onClick={() => setEditing(false)}>취소</button>
          </div>
        </Modal>
      )}

      <div className="folder-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`folder-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            <FolderIcon color={t.color} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'base' && <TripBaseSection trip={trip} />}
      {tab === 'workspace' && <TripWorkspace trip={trip} />}
      {tab === 'settlement' && <ExpensesTab trip={trip} />}
      {tab === 'vouchers' && <VouchersTab trip={trip} />}
      {tab === 'prep' && <TripPrepTab trip={trip} />}
    </Window>
  )
}
