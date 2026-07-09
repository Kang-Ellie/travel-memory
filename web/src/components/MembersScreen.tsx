import { useEffect, useState } from 'react'
import type { Member } from '../../shared/types'
import { api } from '../api'
import Window from './Window'

export default function MembersScreen() {
  const [members, setMembers] = useState<Member[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const refresh = () => { api.members.list().then(setMembers) }
  useEffect(refresh, [])

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

  return (
    <Window title="OUR_CREW.EXE" color="purple">
      <p style={{ marginTop: 0, fontWeight: 700 }}>
        여행에 함께 가는 사람들을 등록해두면, 여행 만들 때 선택하고 가계부 정산에 사용돼요. (나 자신도 등록!)
      </p>
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="field grow">
          <label>이름</label>
          <input type="text" value={name} placeholder="예: 영아"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()} />
        </div>
        <button className="btn primary" onClick={add}>＋ 추가</button>
      </div>
      {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}

      {members.length === 0 ? (
        <div className="empty">아직 등록된 동행인이 없어요.</div>
      ) : members.map((m) => (
        <div key={m.id} className="row">
          <span style={{ fontSize: 20 }}>🧑‍🤝‍🧑</span>
          <div className="grow" style={{ fontWeight: 800 }}>{m.name}</div>
          <button className="btn small ghost" onClick={() => remove(m)}>×</button>
        </div>
      ))}
    </Window>
  )
}
