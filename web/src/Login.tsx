import { useState } from 'react'
import { auth } from './api'

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!passcode) return
    setLoading(true)
    setError('')
    try {
      const res = await auth.login(passcode)
      if ('error' in res) { setError(res.error); return }
      onSuccess()
    } catch {
      setError('서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--paper)',
    }}>
      <div className="window" style={{ width: 320 }}>
        <div className="window-titlebar">
          <span className="window-title">IMMIGRATION · 입국 심사</span>
        </div>
        <div className="window-body">
          <p style={{ marginTop: 0, fontWeight: 700 }}>✈️ 트래블 온에 들어가려면 비밀번호를 입력하세요.</p>
          <div className="field">
            <input
              type="password"
              value={passcode}
              placeholder="비밀번호"
              autoFocus
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}
          <button className="btn primary" style={{ marginTop: 14, width: '100%' }} onClick={submit} disabled={loading}>
            {loading ? '확인 중…' : '입장하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
