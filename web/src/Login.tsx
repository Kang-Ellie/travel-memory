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
      minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 26,
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(168deg, #2f52d4 0%, var(--passport) 45%, var(--passport-deep) 100%)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div className="passport-emblem">✈</div>
        <div className="sidebar-logo-kr">여 백 여 권</div>
        <div className="sidebar-logo-eng">YEOBAEK TRAVEL PASSPORT</div>
      </div>
      <div className="window" style={{ width: 320, marginBottom: 0 }}>
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
