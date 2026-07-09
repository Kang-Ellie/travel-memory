import { useEffect, useState } from 'react'
import type { Country, City } from '../../shared/types'
import { api } from '../api'
import { flagEmoji } from '../categories'
import Window from './Window'

type CountryForm = Omit<Country, 'id' | 'createdAt'>

const EMPTY_FORM: CountryForm = {
  name: '', code: '', capital: '', phoneCode: '', currency: '', voltage: '',
  language: '', visa: '', prepDocs: '', emergencyPolice: '', emergencyMedical: '',
}

function CountryFields({ form, onChange }: { form: CountryForm; onChange: (f: CountryForm) => void }) {
  const set = (k: keyof CountryForm) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...form, [k]: e.target.value })
  return (
    <>
      <div className="form-row">
        <div className="field grow"><label>국가명</label>
          <input type="text" value={form.name ?? ''} placeholder="예: 일본" onChange={set('name')} /></div>
        <div className="field" style={{ maxWidth: 90 }}><label>국가코드</label>
          <input type="text" value={form.code ?? ''} placeholder="JP" maxLength={2} onChange={set('code')} /></div>
        <div className="field"><label>수도</label>
          <input type="text" value={form.capital ?? ''} placeholder="도쿄" onChange={set('capital')} /></div>
        <div className="field"><label>국가번호</label>
          <input type="text" value={form.phoneCode ?? ''} placeholder="+81" onChange={set('phoneCode')} /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>통화</label>
          <input type="text" value={form.currency ?? ''} placeholder="일본 엔 (JPY)" onChange={set('currency')} /></div>
        <div className="field"><label>전압</label>
          <input type="text" value={form.voltage ?? ''} placeholder="110V" onChange={set('voltage')} /></div>
        <div className="field"><label>여행 언어</label>
          <input type="text" value={form.language ?? ''} placeholder="일본어" onChange={set('language')} /></div>
        <div className="field grow"><label>비자</label>
          <input type="text" value={form.visa ?? ''} placeholder="90일 무비자" onChange={set('visa')} /></div>
      </div>
      <div className="form-row">
        <div className="field grow"><label>미리 준비할 서류</label>
          <input type="text" value={form.prepDocs ?? ''} placeholder="Visit Japan Web 필수" onChange={set('prepDocs')} /></div>
        <div className="field"><label>비상연락 · 경찰</label>
          <input type="text" value={form.emergencyPolice ?? ''} placeholder="110" onChange={set('emergencyPolice')} /></div>
        <div className="field"><label>비상연락 · 구급</label>
          <input type="text" value={form.emergencyMedical ?? ''} placeholder="119" onChange={set('emergencyMedical')} /></div>
      </div>
    </>
  )
}

function CityRow({ city, onChanged }: { city: City; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(city.name)
  const [flightDuration, setFlightDuration] = useState(city.flightDuration ?? '')
  const [timeDiff, setTimeDiff] = useState(city.timeDiff ?? '')

  const save = async () => {
    await api.cities.update(city.id, {
      name: name.trim(), flightDuration: flightDuration.trim() || null, timeDiff: timeDiff.trim() || null,
    })
    setEditing(false)
    onChanged()
  }
  const remove = async () => {
    if (!confirm(`'${city.name}' 도시를 삭제할까요?`)) return
    await api.cities.delete(city.id)
    onChanged()
  }

  if (editing) {
    return (
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--yellow-soft)' }}>
        <div className="field"><label>도시명</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>항공 소요시간</label>
          <input type="text" value={flightDuration} placeholder="1시간 15분" onChange={(e) => setFlightDuration(e.target.value)} /></div>
        <div className="field"><label>시차</label>
          <input type="text" value={timeDiff} placeholder="차이없음" onChange={(e) => setTimeDiff(e.target.value)} /></div>
        <button className="btn small primary" onClick={save}>저장</button>
        <button className="btn small" onClick={() => setEditing(false)}>취소</button>
      </div>
    )
  }

  return (
    <div className="row">
      <span className={`chip ${city.visited ? 'green' : 'yellow'}`}>{city.visited ? '가본곳' : '가볼곳'}</span>
      <div className="grow">
        <div style={{ fontWeight: 800 }}>{city.name}</div>
        <div className="muted">
          {city.flightDuration && <>✈️ {city.flightDuration} </>}
          {city.timeDiff && <>· 🕒 시차 {city.timeDiff}</>}
          {!city.flightDuration && !city.timeDiff && '항공 소요시간·시차 미입력'}
        </div>
      </div>
      <button className="btn small" onClick={() => setEditing(true)}>수정</button>
      <button className="btn small ghost" onClick={remove}>×</button>
    </div>
  )
}

function CountryRow({
  country, cities, expanded, onToggle, onChanged,
}: { country: Country; cities: City[]; expanded: boolean; onToggle: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CountryForm>(country)
  const [cityName, setCityName] = useState('')
  const [cityFlight, setCityFlight] = useState('')
  const [cityDiff, setCityDiff] = useState('')

  const save = async () => {
    await api.countries.update(country.id, form)
    setEditing(false)
    onChanged()
  }
  const remove = async () => {
    if (!confirm(`'${country.name}' 국가를 삭제할까요? 소속된 도시도 함께 삭제돼요.`)) return
    await api.countries.delete(country.id)
    onChanged()
  }
  const addCity = async () => {
    if (!cityName.trim()) return
    await api.cities.create({
      countryId: country.id, name: cityName.trim(),
      flightDuration: cityFlight.trim() || null, timeDiff: cityDiff.trim() || null,
    })
    setCityName(''); setCityFlight(''); setCityDiff('')
    onChanged()
  }

  return (
    <div>
      <div className="row" style={{ cursor: 'pointer' }} onClick={() => { if (!editing) onToggle() }}>
        <span style={{ fontSize: 22 }}>{flagEmoji(country.code)}</span>
        <div className="grow">
          <div style={{ fontWeight: 800 }}>{country.name}</div>
          <div className="muted">{cities.length}개 도시 등록됨</div>
        </div>
        <span className="muted">{expanded ? '접기 ▲' : '상세 보기 ▼'}</span>
        <button className="btn small" onClick={(e) => { e.stopPropagation(); setForm(country); setEditing((v) => !v); if (!expanded) onToggle() }}>
          {editing ? '닫기' : '수정'}
        </button>
        <button className="btn small ghost" onClick={(e) => { e.stopPropagation(); remove() }}>×</button>
      </div>

      {expanded && editing && (
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', background: 'var(--yellow-soft)' }}>
          <CountryFields form={form} onChange={setForm} />
          <div><button className="btn small primary" onClick={save}>저장</button></div>
        </div>
      )}

      {expanded && !editing && (
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="form-row" style={{ fontSize: 13 }}>
            <div><strong>수도</strong> {country.capital || '—'}</div>
            <div><strong>국가번호</strong> {country.phoneCode || '—'}</div>
            <div><strong>통화</strong> {country.currency || '—'}</div>
            <div><strong>전압</strong> {country.voltage || '—'}</div>
            <div><strong>언어</strong> {country.language || '—'}</div>
            <div><strong>비자</strong> {country.visa || '—'}</div>
          </div>
          {country.prepDocs && <div>📋 준비서류: {country.prepDocs}</div>}
          <div>🚨 경찰 {country.emergencyPolice || '—'} · 구급 {country.emergencyMedical || '—'}</div>

          <div className="section-gap" style={{ marginTop: 12 }}>
            <strong>도시</strong>
            {cities.length === 0 ? (
              <div className="muted" style={{ marginTop: 6 }}>아직 등록된 도시가 없어요.</div>
            ) : cities.map((c) => <CityRow key={c.id} city={c} onChanged={onChanged} />)}
            <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field"><label>새 도시</label>
                <input type="text" value={cityName} placeholder="예: 후쿠오카" onChange={(e) => setCityName(e.target.value)} /></div>
              <div className="field"><label>항공 소요시간</label>
                <input type="text" value={cityFlight} placeholder="1시간 15분" onChange={(e) => setCityFlight(e.target.value)} /></div>
              <div className="field"><label>시차</label>
                <input type="text" value={cityDiff} placeholder="차이없음" onChange={(e) => setCityDiff(e.target.value)} /></div>
              <button className="btn small" onClick={addCity}>＋ 도시 추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CountriesScreen() {
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<CountryForm>(EMPTY_FORM)

  const refresh = () => {
    api.countries.list().then(setCountries)
    api.cities.list().then(setCities)
  }
  useEffect(refresh, [])

  const create = async () => {
    if (!form.name.trim()) return
    await api.countries.create(form)
    setForm(EMPTY_FORM)
    setCreating(false)
    refresh()
  }

  const citiesByCountry = new Map<string, City[]>()
  for (const c of cities) {
    const list = citiesByCountry.get(c.countryId) ?? []
    list.push(c)
    citiesByCountry.set(c.countryId, list)
  }

  return (
    <div>
      <Window title="COUNTRY_ADD.EXE" color="blue">
        <p className="muted" style={{ marginTop: 0 }}>
          국가별 기본 정보를 한 번 등록해두면 여행을 만들 때 나라·도시를 골라서 자동으로 연결할 수 있어요.
        </p>
        {!creating ? (
          <button className="btn primary" onClick={() => setCreating(true)}>＋ 새 국가 등록</button>
        ) : (
          <>
            <CountryFields form={form} onChange={setForm} />
            <div style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={create}>등록</button>
              <button className="btn" style={{ marginLeft: 6 }} onClick={() => { setCreating(false); setForm(EMPTY_FORM) }}>취소</button>
            </div>
          </>
        )}
      </Window>

      <Window title="COUNTRIES.EXE" color="green">
        {countries.length === 0 ? (
          <div className="empty">아직 등록된 국가가 없어요. 위에서 첫 국가를 등록해보세요! 🌍</div>
        ) : countries.map((c) => (
          <CountryRow
            key={c.id}
            country={c}
            cities={citiesByCountry.get(c.id) ?? []}
            expanded={expandedId === c.id}
            onToggle={() => setExpandedId((cur) => (cur === c.id ? null : c.id))}
            onChanged={refresh}
          />
        ))}
      </Window>
    </div>
  )
}
