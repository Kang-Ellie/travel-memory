# ✈️ 트래블 온 (Travel On)

브라우저에서 도는 여행 기록·정산 웹앱. Mac에서도, 휴대폰에서도 같은 주소로 접속해서 같은 데이터를 봅니다.
여행별 동선(시간·사진·리뷰·꼭 해봐야 하는 것), 가계부·정산, 여행 전 조사한 메모/링크/이미지 보관함,
여러 여행에 걸친 장소 족보(누적 방문 기록·지출)까지 한 곳에서.

## 구조

```
travel-memory/
  web/     프론트엔드 (Vite + React) → Cloudflare Pages에 배포
  server/  API 서버 (Express + PostgreSQL) → Railway에 배포
```

- DB: **Neon** (서버리스 PostgreSQL)
- 백엔드: **Railway** (Express API + 파일 업로드 저장)
- 프론트: **Cloudflare Pages** (정적 사이트)
- 인증: 카카오 로그인 없이 **비밀번호 1개**로만 보호 (가족 단위 개인정보 보호용, 30일간 자동 로그인 유지)

## 로컬에서 실행해보기

**1) 서버**
```bash
cd server
cp .env.example .env      # DATABASE_URL, APP_PASSCODE, SESSION_SECRET 채우기
npm install
npm run dev                # http://localhost:8787
```
로컬 테스트용 Postgres가 없다면 [neon.tech](https://neon.tech)에서 무료 프로젝트를 하나 만들어 `DATABASE_URL`에 바로 써도 됩니다.

**2) 프론트**
```bash
cd web
cp .env.example .env       # VITE_API_BASE=http://localhost:8787
npm install
npm run dev                 # http://localhost:5173
```

## 실제 배포하기

### 1. Neon — DB
1. [neon.tech](https://neon.tech) 가입 → 프로젝트 생성 (리전은 서울에서 가까운 곳 추천)
2. Connection string 복사 (`postgresql://...`) → 아래 Railway 환경변수 `DATABASE_URL`에 사용

### 2. Cloudflare R2 — 파일 저장소 (사진·바우처·보관함 이미지)
1. Cloudflare 대시보드 → R2 → 버킷 생성 (예: `travel-on-uploads`)
2. R2 → 관리 → API 토큰 생성 → "객체 읽기 및 쓰기" 권한으로 발급 → Access Key ID / Secret Access Key 복사
3. 대시보드 오른쪽에 표시되는 **계정 ID**도 복사해두기 (R2_ACCOUNT_ID)
4. 버킷은 **비공개로 유지** — 파일은 로그인 세션이 있어야 서버(`/api/files/*`)를 통해서만 조회됨

### 3. Railway — API 서버
1. [railway.app](https://railway.app) 가입 → New Project → 이 저장소 연결
2. **Root Directory를 `server`로 지정**
3. 환경변수 설정 (`server/.env.example` 참고):
   - `DATABASE_URL` (Neon에서 복사)
   - `APP_PASSCODE` (앱 접속 비밀번호, 직접 정하기)
   - `SESSION_SECRET` (`openssl rand -hex 32`로 생성)
   - `FRONTEND_ORIGIN` (Cloudflare Pages 배포 후 나오는 주소, 예: `https://travel-on.pages.dev`)
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (위 2단계에서 발급)
   - `NODE_ENV=production`
4. Start Command는 `npm start` (package.json에 이미 설정됨)
5. **Railway 볼륨은 더 이상 필요 없음** — 파일은 R2에 저장되므로 컨테이너 재배포와 무관하게 유지됨

### 4. Cloudflare Pages — 프론트
1. Cloudflare 대시보드 → Pages → 이 저장소 연결
2. **Root directory를 `web`로 지정**, Build command `npm run build`, Output directory `dist`
3. 환경변수 `VITE_API_BASE` = Railway에서 발급된 API 주소 (예: `https://travel-on-server.up.railway.app`)
4. 배포 후 나온 Pages 주소를 다시 Railway의 `FRONTEND_ORIGIN`에 넣고 재배포 (서로의 주소를 알아야 CORS/쿠키가 통과됩니다)

## 기능

| 화면 | 내용 |
|---|---|
| 🏝 여행 | 여행 생성/삭제, 예산 설정, D-day |
| 📅 동선 & 가계부 (3열 워크스페이스) | 좌: 일차 이동 + 그날의 메모·날씨 + 예산 진행률/카테고리 지출 요약. 중앙: 드래그로 순서 변경되는 타임라인 — 사진은 카드 왼쪽에 크게, 오른쪽에 방문 시간·꼭 해봐야 하는 것·리뷰·링크. 평소엔 깔끔한 보기 모드, [수정]을 눌러야 편집 모드로 전환. 카드에서 바로 비용 기록(분류·정산 대상 지정). 우: 지도 ↔ 보관함 전환 |
| 📎 보관함 | 여행 전 찾아본 메모·링크·이미지를 모아두고, 카드를 타임라인 위로 드래그하면 해당 일차 일정으로 바로 편입 |
| 🧮 정산 | 참여자는 그 자리에서 즉석 등록 가능(전역 등록 강제 아님). 전체 지출 목록(분류 포함), 통화별 "누가 누구에게 얼마" 자동 계산 |
| 🗺 지도 | 구글 키 등록 시 실제 좌표 기반 지도 (없어도 나머지 기능엔 영향 없음) |
| 📎 바우처 | 항공권 PDF 등 파일 업로드 보관, 아무 기기에서나 열기 |
| 📍 장소 족보 | 한 번 저장해두면 여러 여행에서 재사용하는 장소 DB. 이름을 누르면 이 장소를 방문했던 모든 여행의 리뷰·사진·누적 지출을 모아 봄 |

예산·카테고리 지출 요약은 원화(KRW) 지출만 집계합니다 (여러 통화 여행 시 참고용).

## 구글 API 키 (선택)

장소 검색·지도만 키가 필요. Google Cloud Console에서 프로젝트 생성 → 결제 연결 →
**Places API (New)** + **Maps JavaScript API** 활성화 → API 키 발급 → 앱 [⚙️ 설정]에 붙여넣기.
검색은 서버를 통해 이뤄져 키가 브라우저에 노출되지 않지만, 지도를 그리는 Maps JavaScript는 브라우저에서 직접
불러오므로 Cloud Console에서 **HTTP 리퍼러를 배포 주소로 제한**해두는 걸 권장합니다.
월 무료 한도 내 개인 사용은 대부분 무료 (최신 요금은 콘솔에서 확인).
