import { useState } from 'react'
import type { Country, City } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import { CountryFields, EMPTY_COUNTRY_FORM, type CountryForm } from './CountriesScreen'

// 여행 만들기/수정에서 국가·도시를 고르는 공용 위젯. 여러 국가를 넘나드는 여행도 있을 수 있어서
// 국가도 여러 개 고를 수 있고, 각 국가 밑에 그 나라 도시를 체크한다.
// 국가·도시가 아직 하나도 없어도 여기서 바로 등록하고 골라서 이어갈 수 있게 한다.
export default function TripCountryCityPicker({
  countries, cities, selCountryIds, onSelCountryIdsChange, selCityIds, onSelCityIdsChange, onCatalogChanged,
}: {
  countries: Country[]
  cities: City[]
  selCountryIds: Set<string>
  onSelCountryIdsChange: (ids: Set<string>) => void
  selCityIds: Set<string>
  onSelCityIdsChange: (ids: Set<string>) => void
  onCatalogChanged: () => void
}) {
  const [addingCountry, setAddingCountry] = useState(false)
  const [countryForm, setCountryForm] = useState<CountryForm>(EMPTY_COUNTRY_FORM)
  const [addingCityFor, setAddingCityFor] = useState<string | null>(null)
  const [cityName, setCityName] = useState('')

  const toggleCountry = (id: string) => {
    const next = new Set(selCountryIds)
    if (next.has(id)) {
      next.delete(id)
      const cityNext = new Set(selCityIds)
      for (const c of cities.filter((c) => c.countryId === id)) cityNext.delete(c.id)
      onSelCityIdsChange(cityNext)
    } else {
      next.add(id)
    }
    onSelCountryIdsChange(next)
  }

  const saveCountry = async () => {
    if (!countryForm.name.trim()) return
    const created = await api.countries.create(countryForm)
    setCountryForm(EMPTY_COUNTRY_FORM)
    setAddingCountry(false)
    onSelCountryIdsChange(new Set([...selCountryIds, created.id]))
    onCatalogChanged()
  }

  const saveCity = async (countryId: string) => {
    if (!cityName.trim()) return
    const created = await api.cities.create({ countryId, name: cityName.trim(), flightDuration: null, timeDiff: null })
    setCityName('')
    setAddingCityFor(null)
    onSelCityIdsChange(new Set([...selCityIds, created.id]))
    onCatalogChanged()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {countries.map((c) => (
          <button key={c.id} type="button" className={`pill ${selCountryIds.has(c.id) ? 'active' : ''}`} onClick={() => toggleCountry(c.id)}>
            {flagEmoji(c.code)} {c.name}
          </button>
        ))}
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

      {[...selCountryIds].map((countryId) => {
        const country = countries.find((c) => c.id === countryId)
        const citiesOfCountry = cities.filter((c) => c.countryId === countryId)
        return (
          <div key={countryId} style={{ marginTop: 10 }}>
            <div className="muted" style={{ fontWeight: 700, marginBottom: 4 }}>{flagEmoji(country?.code)} {country?.name} 도시</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {citiesOfCountry.length === 0 ? (
                <span className="muted">이 나라엔 등록된 도시가 없어요.</span>
              ) : citiesOfCountry.map((c) => (
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
              <button type="button" className="btn small ghost" onClick={() => setAddingCityFor(addingCityFor === countryId ? null : countryId)}>
                {addingCityFor === countryId ? '닫기' : '✚ 새 도시 등록'}
              </button>
            </div>
            {addingCityFor === countryId && (
              <div className="row" style={{ marginTop: 8 }}>
                <input type="text" value={cityName} placeholder="예: 후쿠오카" onChange={(e) => setCityName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveCity(countryId)} />
                <button type="button" className="btn small primary" onClick={() => saveCity(countryId)}>도시 등록</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
