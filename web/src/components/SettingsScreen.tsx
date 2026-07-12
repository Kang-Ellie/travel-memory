import { useEffect, useState } from 'react'
import { api, API_BASE } from '../api'
import Window from './Window'
import PageHeader from './PageHeader'

export default function SettingsScreen() {
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.settings.get('googleApiKey').then((v) => setApiKey(v ?? ''))
  }, [])

  const save = async () => {
    await api.settings.set('googleApiKey', apiKey.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <PageHeader icon="⚙️" title="설정" eng="SETTINGS" />
      <Window title="GOOGLE_API.EXE" color="yellow">
        <p style={{ marginTop: 0, fontWeight: 700 }}>
          구글 API 키를 등록하면 <b>장소 검색</b>과 <b>지도 표시</b>가 켜져요.
          키가 없어도 나머지 기능(동선·리뷰·정산·바우처)은 전부 그대로 동작합니다.
        </p>
        <div className="form-row">
          <div className="field grow">
            <label>Google Maps Platform API 키</label>
            <input type="password" value={apiKey} placeholder="AIza..."
              onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <button className="btn primary" onClick={save}>{saved ? '저장됨 ✓' : '저장'}</button>
        </div>
        <div className="muted" style={{ marginTop: 12, lineHeight: 1.7 }}>
          🔑 키 발급: Google Cloud Console → 프로젝트 생성 → 결제 계정 연결 →
          <b> Places API (New)</b>와 <b>Maps JavaScript API</b> 활성화 → 사용자 인증 정보에서 API 키 생성.<br />
          ⚠️ 이 키는 서버(Railway)에 저장되고 지도 검색은 서버를 통해 이뤄져요. 다만 지도를 그리는 Maps JavaScript
          스크립트는 브라우저에서 직접 불러오므로, Cloud Console에서 <b>HTTP 리퍼러를 우리 사이트 주소로 제한</b>해두는 걸 권장해요.<br />
          월 무료 사용량 한도가 있어요(개인 사용량이면 대부분 무료 범위). 최신 요금 정책은 콘솔에서 확인하세요.
        </div>
      </Window>

      <Window title="SERVER_INFO.EXE" color="green">
        <p style={{ marginTop: 0, fontWeight: 700 }}>이 앱의 데이터는 우리 서버(Neon Postgres)에 저장돼요.</p>
        <div className="muted" style={{ lineHeight: 1.8, wordBreak: 'break-all' }}>
          🌐 API 서버: {API_BASE}<br />
          같은 비밀번호로 다른 기기(휴대폰 등)에서 접속하면 동일한 데이터를 볼 수 있어요.
        </div>
      </Window>
    </div>
  )
}
