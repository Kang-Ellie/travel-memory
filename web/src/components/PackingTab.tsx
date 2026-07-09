import type { Trip } from '../../shared/types'
import ChecklistPanel from './ChecklistPanel'
import Window from './Window'

export default function PackingTab({ trip }: { trip: Trip }) {
  return (
    <div>
      <Window title="PACKING.EXE" color="yellow">
        <ChecklistPanel tripId={trip.id} scope="packing" title="🎒 여행 준비물" addPlaceholder="예: 여권, 충전기" />
      </Window>
      <Window title="SHOPPING.EXE" color="purple">
        <ChecklistPanel tripId={trip.id} scope="shopping" title="🛍 사야할 것" addPlaceholder="예: 면세점 화장품" />
      </Window>
      <Window title="FOOD.EXE" color="green">
        <ChecklistPanel tripId={trip.id} scope="food" title="🍽 먹어야할 것" addPlaceholder="예: 멘타이쥬" />
      </Window>
    </div>
  )
}
