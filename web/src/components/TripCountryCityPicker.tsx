import { useState } from 'react'
import type { Country, City } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import Select from './Select'
import { CountryFields, EMPTY_COUNTRY_FORM, type CountryForm } from './CountriesScreen'

// 여행 만들기/수정에서 국가·도시를 고르는 공용 위젯.
// 국가·도시가 아직 하나도 없어도 여기서 바로 등록하고 골라서 이어갈 수 있게 한다.
export default function TripCountryCityPicker({
  countries, cities, selCountryId, onSelCountryChange, selCityIds, onSelCityIdsChange, onCatalogChanged,
}: {
  countries: Country[]
  cities: City[]
  selCountryId: string
  onSelCountryChange: (id: string) => void
  selCityIds: Set<string>
  onSelCityIdsChange: (ids: Set<string>) => void
  onCatalogChanged: () => void
}) {
  const [addingCountry, setAddingCountry] = useState(false)
  const [countryForm, setCountryForm] = useState<CountryForm>(EMPTY_COUNTRY_FORM)
  const [addingCity, setAddingCity] = useState(false)
  const [cityName, setCityName] = useState('')

  const citiesOfSelCountry = cities.filter((c) => c.countryId === selCountryId)

  const saveCountry = async () => {
    if (!countryForm.name.trim()) return
    const created = await api.countries.create(countryForm)
    setCountryForm(EMPTY_COUNTRY_FORM)
    setAddingCountry(false)
    onSelCountryChange(created.id)
    onCatalogChanged()
  }

  const saveCity = async () => {
    if (!cityName.trim() || !selCountryId) return
    const created = await api.cities.create({ countryId: selCountryId, name: cityName.trim(), flightDuration: null, timeDiff: null })
    setCityName('')
    setAddingCity(false)
    onSelCityIdsChange(new Set([...selCityIds, created.id]))
    onCatalogChanged()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Select value={selCountryId} onChange={(e) => onSelCountryChange(e.target.value)}>
          <option value="">— 국가 선택 —</option>
          {countries.map((c) => <option key={c.id} value={c.id}>{flagEmoji(c.code)} {c.name}</option>)}
        </Select>
        <button type="button" className="btn small" onClick={() => setAddingCountry((v) => !v)}>
          {addingCountry ? '닫기' : '✚ 새 국가 등록'}
        </button>
      </div>

      {addingCountry && (
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', background: 'var(--yellow-soft)', marginTop: 8 }}>
          <CountryFields form={countryForm} onChange={setCountryForm} />
          <div><button type="button" className="btn small primary" onClick={saveCountry}>국가 등록</button></div>
        </div>
      )}

      {selCountryId && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {citiesOfSelCountry.length === 0 ? (
              <span className="muted">이 나라엔 등록된 도시가 없어요.</span>
            ) : citiesOfSelCountry.map((c) => (
              <label key={c.id} style={{ fontWeight: 700, display: 'flex', gap: 4, alignItems: 'center' }}>
                <input type="checkbox" checked={selCityIds.has(c.id)}
                  onChange={(e) => {
                    const next = new Set(selCityIds)
                    e.target.checked ? next.add(c.id) : next.delete(c.id)
                    onSelCityIdsChange(next)
                  }} />
                {c.name}
              </label>
            ))}
            <button type="button" className="btn small ghost" onClick={() => setAddingCity((v) => !v)}>
              {addingCity ? '닫기' : '✚ 새 도시 등록'}
            </button>
          </div>
          {addingCity && (
            <div className="row" style={{ marginTop: 8 }}>
              <input type="text" value={cityName} placeholder="예: 후쿠오카" onChange={(e) => setCityName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveCity()} />
              <button type="button" className="btn small primary" onClick={saveCity}>도시 등록</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
