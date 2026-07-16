# 성능 개선 작업 리스트 (전수조사)

> 서버(`server/src/*`) 전 파일과 프론트(`web/src/*`) 전 컴포넌트를 조사한 결과.
> 각 항목에 근거 위치(`파일:줄`)와 개선 방법을 명시. ✅ 체크박스는 작업 추적용.

## 우선순위 요약

| 순위 | 항목 | 효과 | 노력 |
|---|---|---|---|
| 🔴 P1 | DB 인덱스 추가 (현재 0개) | 매우 큼 | 반나절 |
| 🔴 P1 | 타임라인 N+1 쿼리 제거 (이벤트당 6쿼리) | 매우 큼 | 1일 |
| 🔴 P1 | 미사용 20MB mp4 등 public 자산 정리 | 큼 | 10분 |
| 🔴 P1 | 이미지 `loading="lazy"` (현재 0곳) | 큼 | 1시간 |
| 🔴 P1 | 응답 gzip 압축 (현재 없음) | 큼 | 30분 |
| 🟠 P2 | 업로드 시 썸네일 생성 + 목록은 썸네일 사용 | 큼 | 1일 |
| 🟠 P2 | TanStack Query 도입 (전체 refetch 패턴 제거) | 큼 | 2~3일 |
| 🟠 P2 | 화면 단위 코드 스플리팅 | 중간 | 반나절 |
| 🟠 P2 | initSchema → 마이그레이션 체계 (기동 시간) | 중간 | 1일 |
| 🟡 P3 | 파일 서빙 presigned URL 전환 | 중간 | 1~2일 |
| 🟡 P3 | 나머지 세부 항목 | 소~중 | 각 소규모 |

---

## A. 백엔드

### A-1. 쿼리 (가장 효과 큰 영역)

- [ ] **N+1: 타임라인 로드** — `routes.ts:743-765` `loadEvents()`가 이벤트마다 place·photos·flight·valet·lodging·reservation 6쿼리를 순차 실행. 일정 50개면 **요청 1번에 300+ 쿼리** (Neon은 왕복 지연이 커서 더 아픔). → 이벤트 id 목록을 뽑은 뒤 각 상세 테이블을 `WHERE event_id = ANY($1)` 한 방씩(총 7쿼리 고정)으로 가져와 JS에서 매핑하거나, LEFT JOIN + `json_agg`로 단일 쿼리화.
- [ ] **N+1: 장소 상세** — `routes.ts:444-480` `/api/places/:id/detail`도 방문 이벤트마다 동일한 5쿼리 루프. 같은 방식으로 배치화.
- [ ] **N+1: 지출 목록** — `routes.ts:1007-1018` 지출마다 `expense_splits` 1쿼리. → `LEFT JOIN expense_splits ... GROUP BY` + `array_agg(member_id)` 단일 쿼리.
- [ ] **인덱스 전무** — `db.ts`에 `CREATE INDEX`가 하나도 없음. 지금은 데이터가 적어 못 느끼지만 사진·지출이 쌓이면 전부 풀스캔. 최소 세트:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_events_trip_day ON timeline_events (trip_id, day_number, sequence);
  CREATE INDEX IF NOT EXISTS idx_events_place    ON timeline_events (place_id);
  CREATE INDEX IF NOT EXISTS idx_photos_event    ON photos (event_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_trip   ON expenses (trip_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_event  ON expenses (event_id);
  CREATE INDEX IF NOT EXISTS idx_archive_trip    ON archive_items (trip_id);
  CREATE INDEX IF NOT EXISTS idx_checklist_trip  ON checklist_items (trip_id, scope, day_number);
  CREATE INDEX IF NOT EXISTS idx_transit_trip    ON transit_segments (trip_id, day_number);
  CREATE INDEX IF NOT EXISTS idx_daynote_photos  ON day_note_photos (trip_id, day_number);
  CREATE INDEX IF NOT EXISTS idx_activity_time   ON activity_log (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_places_city     ON places (city_id);
  CREATE INDEX IF NOT EXISTS idx_cities_country  ON cities (country_id);
  CREATE INDEX IF NOT EXISTS idx_trip_cities_city ON trip_cities (city_id);
  CREATE INDEX IF NOT EXISTS idx_vouchers_trip   ON vouchers (trip_id);
  ```
- [ ] **상관 서브쿼리 반복** — `routes.ts:357-369` `PLACE_SELECT`의 cover_photo·visit_count 서브쿼리가 장소 행마다 실행됨(`/api/places`는 전체 장소 × 2 서브쿼리). → `LEFT JOIN LATERAL` 또는 사전 집계 CTE로. 위 인덱스(idx_events_place, idx_photos_event)만 넣어도 크게 완화.
- [ ] **대시보드 전량 로드** — `routes.ts:1462` `SELECT trip_id, amount, currency FROM expenses` 전체 지출을 메모리로 가져와 JS 집계. → `GROUP BY trip_id, currency` SQL 집계로. 갤러리도 300+300행 고정 로드(`1512-1520`) → limit 쿼리 파라미터화 + 프론트 페이지네이션과 연동.

### A-2. 쓰기 경로

- [ ] **루프 INSERT/UPDATE (왕복 폭증)** —
  - `routes.ts:823-831` 드래그 재정렬: 항목마다 UPDATE. → `UPDATE ... FROM unnest($1::text[], $2::int[])` 단일 쿼리.
  - `routes.ts:222-227` `setTripCities`, `routes.ts:281-283` 멤버 연결, `routes.ts:1038-1040` 정산 대상: 동일 패턴. → 다중 VALUES 단일 INSERT.
  - `routes.ts:190-205` `seedChecklistPresets`: 여행 생성마다 ~30회 순차 INSERT. → 한 번의 다중 VALUES.
- [ ] **트랜잭션 0회** — 여행 생성(trips + trip_members + trip_cities + 시드 2종 + 로그), 재정렬, 보관함→일정 변환(`routes.ts:1186-1211`, 장소+이벤트+사진 생성 후 원본 삭제) 등 다단계 쓰기가 전부 비원자적. 중간 실패 시 반쪽 데이터가 남고, 왕복도 많음. → `pool.connect()` + BEGIN/COMMIT 헬퍼 하나 만들어 다단계 쓰기에 적용.
- [ ] **사진 다중 업로드 순차 처리** — `routes.ts:1095-1105`, `1272-1308` 파일마다 sharp 압축→R2 업로드→INSERT를 순차 await. 10장이면 처리시간 ×10. → `Promise.all` + 동시성 제한(3~4개, p-limit)으로 병렬화.
- [ ] **logActivity가 응답 경로에서 await** — `routes.ts:36-41`. 활동 로그는 부가 기능이므로 응답 후 fire-and-forget(catch만)으로 빼면 쓰기 API 지연이 줄어듦.
- [ ] **activity_log 무한 증가** — 보존 정책 없음. 주기적으로 오래된 행 삭제(예: 최근 500개만 유지)하는 정리 쿼리 추가.

### A-3. 서버 구성

- [ ] **응답 압축 없음** — `index.ts`에 compression 미들웨어 없음. 타임라인/장소 JSON은 수백 KB까지 커질 수 있고 텍스트라 gzip 효율이 큼. → `compression` 패키지 한 줄 (이미지 스트리밍 라우트는 제외).
- [ ] **initSchema가 기동마다 400줄 DDL 재실행** — `db.ts:8-409`. ALTER/UPDATE 수십 개가 Railway 재배포·재시작마다 Neon에 순차 실행되어 콜드스타트를 늘림. → node-pg-migrate 등으로 이관하고 적용된 마이그레이션은 스킵.
- [ ] **pg Pool 기본 설정** — `db.ts:3-6`. Neon은 동시 커넥션 제한이 있고 유휴 비용도 있음. → `max`(Railway 단일 인스턴스면 5~10), `idleTimeoutMillis`, `connectionTimeoutMillis` 명시. Neon의 pooled connection string(`-pooler`) 사용 검토. `rejectUnauthorized: false`도 Neon CA 검증으로 바꾸는 것 권장(보안).
- [ ] **프로덕션을 tsx로 구동** — `server/package.json` `start: tsx src/index.ts`. 기동 시간·메모리 오버헤드. → `tsc`로 빌드 후 `node dist/index.js`.
- [ ] **로그인 rate limit 없음** — `routes.ts:233`. 성능이라기보다 보안이지만, 무제한 시도는 DoS 벡터이기도 함. → express-rate-limit + `crypto.timingSafeEqual` 비교.

### A-4. 파일 서빙

- [ ] **모든 이미지가 서버 경유 스트리밍** — `upload.ts:91-104` + `routes.ts:263-266`. 사진 한 장마다 브라우저→Railway(단일 리전)→R2→다시 브라우저. 갤러리 24장이면 Railway가 24번 프록시. `Cache-Control: private`이라 CDN 캐시도 불가. → 단기: 현행 유지(브라우저 immutable 캐시는 이미 있음). 중기: 만료 짧은 **R2 presigned URL**을 API 응답에 포함시켜 브라우저가 R2에서 직접 받게 하거나, Cloudflare Worker 프록시로 엣지 캐시.
- [ ] **썸네일 부재** — 업로드 시 2000px/품질82 단일 변형만 저장(`upload.ts:60-72`). 대시보드 캘린더 셀, 갤러리 그리드, 타임라인 카드 전부 원본(수백 KB~1MB)을 로드. → 업로드 시 ~400px 썸네일을 함께 저장(`photos/thumb/...`)하고 목록 UI는 썸네일, 라이트박스만 원본.

---

## B. 프론트엔드

### B-1. 정적 자산 (즉효)

- [ ] **미사용 20.7MB 동영상 배포 중** — `web/public/109821-685694725.mp4`. 코드 어디서도 참조 안 함(전수 grep 확인). 배포 아티팩트만 키움. → 삭제.
- [ ] **미사용/중복 이미지 정리** — `file.png`(203KB), `연차계획.png`(77KB), `대지 1_13.png`(131KB), `Purple_..._1_-removebg-preview.png`(171KB), `2.플래너.png`, `3.투두리스트.png`, 웹p 시안들 — 참조되는 것은 `할일목록 v.png` 하나뿐(`TripBaseSection.tsx:501`). → 쓰는 것만 남기고 삭제, 남기는 PNG는 webp로 변환.
- [ ] **폰트 로딩** — `index.html:12` 구글 폰트 CSS가 렌더 블로킹, `main.tsx:3` typeface-nanum-barun-gothic 전체 웨이트 로드. → `display=swap` 확인, 실제 쓰는 웨이트만 남기기, 한글 서브셋 woff2 self-host + `<link rel="preload">` 검토.

### B-2. 이미지 렌더링

- [ ] **`loading="lazy"` 사용 0곳** (전수 grep 확인) — 대시보드 갤러리·캘린더, 타임라인 사진, 보관함, 장소 카드의 모든 `<img>`가 즉시 로드. → 목록/그리드 이미지 전부에 `loading="lazy" decoding="async"` 추가. 1시간짜리 작업으로 초기 로드 체감이 가장 크게 바뀌는 항목 중 하나.
- [ ] **원본 크기 이미지를 그리드에 사용** — A-4 썸네일 항목과 짝. 서버 썸네일이 생기면 `fileUrl()`에 variant 파라미터를 추가해 목록 UI에서 사용.
- [ ] **라이트박스 프리로드** — 현재는 열 때 원본 로드. 이전/다음 이미지 1장씩 미리 로드하면 넘김이 부드러워짐 (소규모).

### B-3. 데이터 페칭 구조 (구조적으로 가장 중요)

- [ ] **캐시 계층 부재 + 전체 refetch 패턴** — `TripWorkspace.tsx:818-829` `refresh()`가 API 9개를 호출하고, 지출 삭제 하나(`onChanged`)에도 9개 전부 재호출. 화면 전환·탭 전환마다 언마운트→재마운트로 매번 처음부터 다시 fetch (`TripWindow.tsx:189-193`의 탭 조건부 렌더). → **TanStack Query 도입**: 쿼리 키별 캐시로 탭 왕복 시 즉시 표시, 변경 시 해당 리소스만 invalidate, 지출 추가/삭제는 낙관적 업데이트. 이 프로젝트에서 가장 투자 대비 효과가 큰 구조 개선.
- [ ] **공용 데이터 중복 fetch** — countries/cities를 `App.tsx:89`, `TripWindow.tsx:52-55`, CountriesScreen, TripCountryCityPicker 등에서 각각 로드. places도 TripWorkspace가 전체 목록을 로드. → Query 캐시로 통합하면 자동 해결.
- [ ] **bucket.list() 전역 로드** — `TripWorkspace.tsx:826` 일정 화면에서 버킷 전체를 항상 로드하지만 편집 모달에서만 사용. → 모달 열 때 lazy fetch.

### B-4. 렌더링

- [ ] **메모이제이션 사용 0회** (전수 grep 확인: `useMemo`/`useCallback`/`React.memo` 없음) — `TripWorkspace.tsx:831-850`의 dayEvents 정렬, expensesByEvent Map 구성 등이 어떤 state 변경에도(입력 타이핑 포함) 매 렌더 재계산되고, 모든 EventCard가 리렌더. 지금 데이터 규모에선 견디지만 사진 많은 여행에서 드래그·타이핑이 버벅이는 원인이 됨. → 파생값 `useMemo`, `EventCard`를 `React.memo`로, 콜백 안정화.
- [ ] **EventCard 거대 상태** — `TripWorkspace.tsx:199-260` useState 30여 개가 카드마다 생성됨(편집 안 해도). → 표시 전용 카드와 "편집 모달(열 때 mount)" 분리. 렌더 비용과 메모리 모두 감소.
- [ ] **긴 목록 페이지네이션** — 대시보드 갤러리는 `visibleCount`로 잘라 그리지만(`DashboardScreen.tsx:32`), URL 배열 생성 등은 전체 대상. 장소 족보·버킷리스트 화면은 전량 렌더. → 항목 수가 커지면 가상 스크롤(react-virtual) 검토 (지금은 P3).

### B-5. 번들·로딩

- [ ] **코드 스플리팅 없음** — `React.lazy` 사용 0회. 60여 컴포넌트 + 화면 6개가 단일 청크로, 로그인 화면만 봐도 전체 다운로드. → 화면(Screen) 단위 `React.lazy` + `Suspense`, vite `manualChunks`로 react 벤더 분리.
- [ ] **번들 가시화 습관** — rollup-plugin-visualizer를 build에 붙여 회귀 감시 (한 번 설정).
- [ ] **서비스워커가 순수 오버헤드** — `public/sw.js:5-7` 모든 요청을 `respondWith(fetch())`로 감싸기만 함: 캐시 이점 0, SW hop 추가, 대용량 스트리밍/Range 요청에서 문제 소지. → fetch 핸들러를 아예 제거(설치 조건은 유지됨)하거나, 정적 자산 stale-while-revalidate + 이미지 캐시 전략으로 제대로 구현.
- [ ] **API_BASE 프리커넥트** — `index.html`에 API 도메인 `<link rel="preconnect">` 추가하면 첫 요청 TLS 핸드셰이크 절약 (소규모).

---

## C. 권장 작업 순서 (스프린트 안)

1. **1일차 — 즉효 묶음**: mp4·미사용 이미지 삭제 → `loading="lazy"` 일괄 추가 → compression 미들웨어 → 인덱스 마이그레이션. (여기까지만 해도 체감 60%)
2. **2~3일차 — 쿼리 정리**: loadEvents/placeDetail/expenses N+1 제거, 루프 INSERT 배치화 + 트랜잭션 헬퍼.
3. **4~5일차 — 이미지 파이프라인**: 썸네일 생성 + 목록 UI 썸네일 적용, 업로드 병렬화.
4. **다음 스프린트 — 구조 개선**: TanStack Query 도입, 화면 코드 스플리팅, initSchema → 마이그레이션 도구, EventCard 분리.

> 측정 없이 최적화하지 말 것: 각 단계 전후로 (1) 여행 일정 탭 열기까지 시간, (2) 대시보드 로드 시 네트워크 총량, (3) `EXPLAIN ANALYZE`로 주요 쿼리 실행계획을 기록해두면 개선 폭이 수치로 남고, 포트폴리오 스토리도 된다.
