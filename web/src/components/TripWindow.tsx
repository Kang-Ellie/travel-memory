import { useState } from 'react'
import type { Trip } from '../../shared/types'
import Window from './Window'
import TripWorkspace from './TripWorkspace'
import ExpensesTab from './ExpensesTab'
import VouchersTab from './VouchersTab'

type Tab = 'workspace' | 'settlement' | 'vouchers'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'workspace', label: '📅 동선 & 가계부' },
  { key: 'settlement', label: '🧮 정산' },
  { key: 'vouchers', label: '📎 바우처' },
]

interface Props {
  trip: Trip
  onClose: () => void
  onTripChanged: (t: Trip) => void
}

export default function TripWindow({ trip, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('workspace')

  return (
    <Window title={`${trip.title.replace(/\s+/g, '_').toUpperCase()}.EXE`} color="blue" onClose={onClose}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {TABS.map((t) => (
          <button key={t.key} className={`pill ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'workspace' && <TripWorkspace trip={trip} />}
      {tab === 'settlement' && <ExpensesTab trip={trip} />}
      {tab === 'vouchers' && <VouchersTab trip={trip} />}
    </Window>
  )
}
