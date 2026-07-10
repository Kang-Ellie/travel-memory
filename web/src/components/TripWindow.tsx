import { useEffect, useState } from 'react'
import type { Country, City, Trip } from '../../shared/types'
import { api } from '../api'
import { tripCitiesLabel } from '../categories'
import Window from './Window'
import Modal from './Modal'
import DatePicker from './DatePicker'
import TripCountryCityPicker from './TripCountryCityPicker'
import TripWorkspace from './TripWorkspace'
import ExpensesTab from './ExpensesTab'
import VouchersTab from './VouchersTab'
import TripPrepTab from './TripPrepTab'

type Tab = 'workspace' | 'settlement' | 'vouchers' | 'prep'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'workspace', label: '📅 동선 & 가계부' },
  { key: 'settlement', label: '🧮 정산' },
  { key: 'vouchers', label: '📎 바우처' },
  { key: 'prep', label: '🧳 여행 준비' },
]

interface Props {
  trip: Trip
  onClose: () => void
  onTripChanged: (t: Trip) => void
}

export default function TripWindow({ trip, onClose, onTripChanged }: Props) {
  const [tab, setTab] = useState<Tab>('workspace')
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(trip.title)
  const [startDate, setStartDate] = useState(trip.startDate)
  const [endDate, setEndDate] = useState(trip.endDate)
  const [budget, setBudget] = useState(String(trip.budget || ''))
  const [selCountryId, setSelCountryId] = useState('')
  const [selCityIds, setSelCityIds] = useState<Set<string>>(new Set(trip.cities.map((c) => c.id)))

  useEffect(() => {
    api.countries.list().then(setCountries)
    api.cities.list().then(setCities)
  }, [])

  const startEdit = () => {
    setTitle(trip.title); setStartDate(trip.startDate); setEndDate(trip.endDate)
    setBudget(String(trip.budget || '')); setSelCityIds(new Set(trip.cities.map((c) => c.id)))
    const firstCity = trip.cities[0]
    const firstCountry = firstCity ? cities.find((c) => c.id === firstCity.id)?.countryId ?? '' : ''
    setSelCountryId(firstCountry)
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

  return (
    <Window title={`${trip.title.replace(/\s+/g, '_').toUpperCase()}.EXE`} color="blue" onClose={onClose}>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="grow">
          {trip.cities.length > 0 ? (
            <span className="muted">{tripCitiesLabel(trip)}</span>
          ) : (
            <span className="muted">🌍 국가·도시가 아직 연결 안 됐어요.</span>
          )}
        </div>
        <button className="btn small" onClick={startEdit}>✏️ 여행 정보 수정</button>
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
              selCountryId={selCountryId}
              onSelCountryChange={setSelCountryId}
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, marginTop: 12 }}>
        {TABS.map((t) => (
          <button key={t.key} className={`pill ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'workspace' && <TripWorkspace trip={trip} />}
      {tab === 'settlement' && <ExpensesTab trip={trip} />}
      {tab === 'vouchers' && <VouchersTab trip={trip} />}
      {tab === 'prep' && <TripPrepTab trip={trip} />}
    </Window>
  )
}
