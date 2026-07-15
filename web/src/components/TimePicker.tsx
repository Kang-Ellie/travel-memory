import Select from './Select'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

// 브라우저 기본 <input type="time"> 대신, 앱 톤에 맞는 커스텀 시간 선택기.
// value/onChange는 type="time"과 동일하게 'HH:mm' 문자열로 주고받는다.
export default function TimePicker({
  value, onChange, style,
}: { value: string; onChange: (e: { target: { value: string } }) => void; style?: React.CSSProperties }) {
  const [hour, minute] = value ? value.split(':') : ['', '']

  const emit = (h: string, m: string) => {
    if (!h && !m) { onChange({ target: { value: '' } }); return }
    onChange({ target: { value: `${h || '00'}:${m || '00'}` } })
  }

  return (
    <div style={{ display: 'flex', gap: 6, ...style }}>
      <Select value={hour} onChange={(e) => emit(e.target.value, minute)} style={{ width: 74 }}>
        <option value="">시</option>
        {HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}
      </Select>
      <Select value={minute} onChange={(e) => emit(hour, e.target.value)} style={{ width: 74 }}>
        <option value="">분</option>
        {MINUTES.map((m) => <option key={m} value={m}>{m}분</option>)}
      </Select>
    </div>
  )
}
