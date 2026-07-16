import { useEffect, useState, type CSSProperties } from 'react'
import type { Country, City, Trip } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import Modal from './Modal'
import DatePicker from './DatePicker'
import TripCountryCityPicker from './TripCountryCityPicker'
import TripWorkspace from './TripWorkspace'
import TripBaseSection from './TripBaseSection'
import ExpensesTab from './ExpensesTab'
import SettlementTab from './SettlementTab'
import TripPrepTab from './TripPrepTab'
import PrintItinerary from './PrintItinerary'
import TripSummaryCard from './TripSummaryCard'

type Tab = 'base' | 'prep' | 'workspace' | 'expenses' | 'settlement'

const TABS: Array<{ key: Tab; icon: string; label: string; color: string }> = [
  { key: 'base', icon: '🧭', label: 'BASE', color: '#3a7d99' },
  { key: 'prep', icon: '🎒', label: '여행 준비', color: '#3f8a55' },
  { key: 'workspace', icon: '📅', label: '일정', color: '#7a5fb8' },
  { key: 'expenses', icon: '💸', label: '지출', color: '#a8842a' },
  { key: 'settlement', icon: '🧮', label: '정산', color: '#c8446f' },
]

// 여권 하단의 기계판독영역(MRZ)처럼 보이는 장식용 문자열 — 영숫자만 남기고 나머지는 '<'로 채운다.
function mrzLine(raw: string, len = 44): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '<')
  return (s + '<'.repeat(len)).slice(0, len)
}

interface Props {
  trip: Trip
  onClose: () => void
  onTripChanged: (t: Trip) => void
}

export default function TripWindow({ trip, onClose, onTripChanged }: Props) {
  const [tab, setTab] = useState<Tab>('base')
  const [showPrint, setShowPrint] = useState(false)
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(trip.title)
  const [startDate, setStartDate] = useState(trip.startDate)
  const [endDate, setEndDate] = useState(trip.endDate)
  const [budget, setBudget] = useState(String(trip.budget || ''))
  const [nights, setNights] = useState(trip.nights != null ? String(trip.nights) : '')
  const [selCountryIds, setSelCountryIds] = useState<Set<string>>(new Set())
  const [selCityIds, setSelCityIds] = useState<Set<string>>(new Set(trip.cities.map((c) => c.id)))

  useEffect(() => {
    api.countries.list().then(setCountries)
    api.cities.list().then(setCities)
  }, [])

  const startEdit = () => {
    setTitle(trip.title); setStartDate(trip.startDate); setEndDate(trip.endDate)
    setBudget(String(trip.budget || '')); setNights(trip.nights != null ? String(trip.nights) : ''); setSelCityIds(new Set(trip.cities.map((c) => c.id)))
    const tripCountryIds = new Set(
      trip.cities.map((tc) => cities.find((c) => c.id === tc.id)?.countryId).filter((id): id is string => !!id),
    )
    setSelCountryIds(tripCountryIds)
    setEditing(true)
  }

  const save = async () => {
    if (!title.trim() || !startDate || !endDate) return
    await api.trips.update(trip.id, {
      title: title.trim(), startDate, endDate, budget: parseFloat(budget) || 0,
      nights: nights.trim() ? parseInt(nights) : null, cityIds: [...selCityIds],
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

  const countryCodes = [...new Set(trip.cities.map((c) => c.countryCode).filter(Boolean))].join('')
  const mrz1 = mrzLine(`P<TRIP<${countryCodes}<${trip.title}`)
  const mrz2 = mrzLine(`${trip.startDate}<${trip.endDate}<${trip.id.slice(0, 8)}<YEOBAEK`)

  return (
    <div>
      {/* 비자 페이지 스타일 문서 헤더 */}
      <div className="trip-doc-head">
        <div className="trip-doc-topline">
          <button className="btn small ghost" onClick={onClose}>← 목록</button>
          <span className="trip-doc-eyebrow">TRIP DOCUMENT · 여행 서류</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="btn small" onClick={() => setShowPrint(true)} title="일정 인쇄/PDF 보기">🖨 인쇄</button>
            <button className="btn small" onClick={startEdit} title="여행 정보 수정">⚙️ 수정</button>
          </span>
        </div>
        <h2 className="trip-doc-title">{trip.title}</h2>
        <div className="trip-doc-route">
          {trip.cities.length > 0 ? (
            [...citiesByCountry.values()].map((c) => (
              <span key={c.name}>
                {flagEmoji(c.code)} {c.name} · {c.cities.join(', ')}
              </span>
            ))
          ) : (
            <span>🌍 국가·도시가 아직 연결 안 됐어요 — 오른쪽 위 [⚙️ 수정]에서 등록해보세요.</span>
          )}
        </div>
        <TripSummaryCard trip={trip} />
        <div className="trip-mrz" aria-hidden="true">
          <div>{mrz1}</div>
          <div>{mrz2}</div>
        </div>
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
            <div className="field" style={{ maxWidth: 120 }}>
              <label>몇 박</label>
              <input type="number" value={nights} min={0}
                placeholder={
                  startDate && endDate && endDate >= startDate
                    ? `기본 ${Math.round((new Date(endDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime()) / 86_400_000)}박`
                    : '예: 2'
                }
                onChange={(e) => setNights(e.target.value)} />
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

      {/* 바인더 인덱스 탭 + 서류 시트 */}
      <div className="doc-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`doc-tab ${tab === t.key ? 'active' : ''}`}
            style={{ '--tab-color': t.color } as CSSProperties}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div className="doc-tab-sheet">
        {tab === 'base' && <TripBaseSection trip={trip} />}
        {tab === 'prep' && <TripPrepTab trip={trip} />}
        {tab === 'workspace' && <TripWorkspace trip={trip} />}
        {tab === 'expenses' && <ExpensesTab trip={trip} />}
        {tab === 'settlement' && <SettlementTab trip={trip} />}
      </div>

      {showPrint && <PrintItinerary trip={trip} onClose={() => setShowPrint(false)} />}
    </div>
  )
}
