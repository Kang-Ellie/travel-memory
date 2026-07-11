import DatePicker from './DatePicker'
import Select from './Select'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

// 브라우저 기본 <input type="datetime-local"> 대신, 앱 톤에 맞는 커스텀 날짜·시간 선택기.
// value/onChange는 datetime-local과 동일하게 'YYYY-MM-DDTHH:mm' 문자열로 주고받는다.
export default function DateTimePicker({
  value, onChange, style,
}: { value: string; onChange: (e: { target: { value: string } }) => void; style?: React.CSSProperties }) {
  const [datePart, timePart] = value ? value.split('T') : ['', '']
  const hour = timePart ? timePart.split(':')[0] : ''
  const minute = timePart ? timePart.split(':')[1] : ''

  const emit = (d: string, h: string, m: string) => {
    if (!d) { onChange({ target: { value: '' } }); return }
    onChange({ target: { value: `${d}T${h || '00'}:${m || '00'}` } })
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', ...style }}>
      <DatePicker value={datePart} onChange={(e) => emit(e.target.value, hour, minute)} />
      <Select value={hour} onChange={(e) => emit(datePart, e.target.value, minute)} style={{ width: 74 }}>
        <option value="">시</option>
        {HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}
      </Select>
      <Select value={minute} onChange={(e) => emit(datePart, hour, e.target.value)} style={{ width: 74 }}>
        <option value="">분</option>
        {MINUTES.map((m) => <option key={m} value={m}>{m}분</option>)}
      </Select>
    </div>
  )
}
