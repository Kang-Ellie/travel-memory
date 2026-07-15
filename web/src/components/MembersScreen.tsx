import { useEffect, useRef, useState } from 'react'
import type { Member } from '../../shared/types'
import { api } from '../api'
import Window from './Window'
import PageHeader from './PageHeader'

const MEMBER_EMOJIS = ['🧑', '👩', '👨', '👵', '👴', '👧', '👦', '🐶', '🐱']

export default function MembersScreen({
  autoOpenAdd, onConsumedAutoOpenAdd,
}: { autoOpenAdd?: boolean; onConsumedAutoOpenAdd?: () => void }) {
  const [members, setMembers] = useState<Member[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [editingEmojiFor, setEditingEmojiFor] = useState<string | null>(null)
  const nameInput = useRef<HTMLInputElement>(null)

  const refresh = () => { api.members.list().then(setMembers) }
  useEffect(refresh, [])

  useEffect(() => {
    if (autoOpenAdd) { nameInput.current?.focus(); onConsumedAutoOpenAdd?.() }
  }, [autoOpenAdd])

  const add = async () => {
    if (!name.trim()) return
    setError('')
    const res = await api.members.create(name)
    if ('error' in res) { setError(res.error); return }
    setName('')
    refresh()
  }

  const remove = async (m: Member) => {
    if (!confirm(`'${m.name}'을(를) 삭제할까요?`)) return
    const res = await api.members.delete(m.id)
    if (res.error) alert(res.error)
    refresh()
  }

  const setEmoji = async (m: Member, emoji: string) => {
    await api.members.update(m.id, m.emoji === emoji ? null : emoji)
    setEditingEmojiFor(null)
    refresh()
  }

  const editingMember = members.find((m) => m.id === editingEmojiFor) ?? null

  return (
    <div>
      <PageHeader icon="👥" title="동행인" eng="PEOPLE"
        description="여행에 함께 가는 사람들을 등록해두면, 여행 만들 때 선택하고 가계부 정산에 사용돼요. (나 자신도 등록!)" />
      <Window title="OUR_CREW.EXE" color="purple">
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="field grow">
          <label>이름</label>
          <input ref={nameInput} type="text" value={name} placeholder="예: 영아"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()} />
        </div>
        <button className="btn primary" onClick={add}>＋ 추가</button>
      </div>
      {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}

      {members.length === 0 ? (
        <div className="empty">아직 등록된 동행인이 없어요.</div>
      ) : (
        <div className="mini-card-grid">
          {members.map((m) => (
            <div key={m.id} className="card mini-card" style={{ cursor: 'default' }}>
              <button className="x-btn" onClick={() => remove(m)}>×</button>
              <button type="button" className="mini-card-emoji" title="이모지 변경"
                onClick={() => setEditingEmojiFor(editingEmojiFor === m.id ? null : m.id)}>
                {m.emoji || '🧑'}
              </button>
              <div className="mini-card-name">{m.name}</div>
            </div>
          ))}
        </div>
      )}
      {editingMember && (
        <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <span className="grow" style={{ fontWeight: 800 }}>{editingMember.name}의 이모지</span>
          <div className="emoji-pick-row">
            {MEMBER_EMOJIS.map((e) => (
              <button key={e} type="button" className={`emoji-pick ${editingMember.emoji === e ? 'active' : ''}`}
                onClick={() => setEmoji(editingMember, e)}>{e}</button>
            ))}
          </div>
          <button className="btn small" onClick={() => setEditingEmojiFor(null)}>닫기</button>
        </div>
      )}
      </Window>
    </div>
  )
}
