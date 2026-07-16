import { useEffect, useState } from 'react'
import type { ActivityLogEntry } from '../../shared/types'
import { api } from '../api'

const ACTION_ICON: Record<string, string> = {
  trip_created: '🧳', member_added: '🧑‍🤝‍🧑', place_added: '📍',
  expense_added: '💸', event_added: '🗓', bucket_added: '✨',
}
const ACTION_VERB: Record<string, string> = {
  trip_created: '여행 생성됨', member_added: '동행인 추가됨', place_added: '장소 추가됨',
  expense_added: '지출 기록됨', event_added: '일정에 추가됨', bucket_added: '버킷리스트 추가됨',
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

// 가족이 같이 쓰는 앱이라 "방금 뭐가 추가됐는지" 훑어보는 피드. 공용 비밀번호 로그인이라
// "누가"는 알 수 없어서 "무엇을·언제"만 보여준다.
export default function ActivityFeed({ items: itemsProp }: { items?: ActivityLogEntry[] } = {}) {
  const [itemsState, setItems] = useState<ActivityLogEntry[]>([])

  useEffect(() => { if (!itemsProp) api.activity.list(20).then(setItems) }, [itemsProp])

  const items = itemsProp ?? itemsState

  if (items.length === 0) {
    return <div className="empty">아직 활동 기록이 없어요.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it) => (
        <div key={it.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span>{ACTION_ICON[it.action] ?? '•'}</span>
          <span className="grow">
            <b>{it.summary}</b>
            <span className="muted"> {ACTION_VERB[it.action] ?? it.action}{it.tripTitle ? ` · ${it.tripTitle}` : ''}</span>
          </span>
          <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{timeAgo(it.createdAt)}</span>
        </div>
      ))}
    </div>
  )
}
