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
| ✅ | 업로드 시 썸네일 생성 + 목록은 썸네일 사용 | 큼 | 완료 |
| ✅ | TanStack Query 도입 (전체 refetch 패턴 제거) | 큼 | 완료 |
| ✅ | 트랜잭션 + 루프 INSERT 배치화 | 큼 | 완료 |
| ✅ | initSchema → 마이그레이션 체계 (기동 시간) | 중간 | 완료 |
| 🟠 P2 | 화면 단위 코드 스플리팅 | 중간 | 반나절 |
| 🟡 P3 | 파일 서빙 presigned URL 전환 | 중간 | 1~2일 |
| 🟡 P3 | 나머지 세부 항목 | 소~중 | 각 소규모 |

---

## A. 백엔드

### A-1. 쿼리 (가장 효과 큰 영역)

- [x] **N+1: 타임라인 로드** ✅ 2026-07-16 완료 — `routes.ts:743-765` `loadEvents()`가 이벤트마다 place·photos·flight·valet·lodging·reservation 6쿼리를 순차 실행. 일정 50개면 **요청 1번에 300+ 쿼리** (Neon은 왕복 지연이 커서 더 아픔). → 이벤트 id 목록을 뽑은 뒤 각 상세 테이블을 `WHERE event_id = ANY($1)` 한 방씩(총 7쿼리 고정)으로 가져와 JS에서 매핑하거나, LEFT JOIN + `json_agg`로 단일 쿼리화.
- [x] **N+1: 장소 상세** ✅ 2026-07-16 완료 — `routes.ts:444-480` `/api/places/:id/detail`도 방문 이벤트마다 동일한 5쿼리 루프. 같은 방식으로 배치화.
- [x] **N+1: 지출 목록** ✅ 2026-07-16 완료 — `routes.ts:1007-1018` 지출마다 `expense_splits` 1쿼리. → `LEFT JOIN expense_splits ... GROUP BY` + `array_agg(member_id)` 단일 쿼리.
- [x] **인덱스 전무** ✅ 2026-07-16 완료 — `db.ts`에 `CREATE INDEX`가 하나도 없음. 지금은 데이터가 적어 못 느끼지만 사진·지출이 쌓이면 전부 풀스캔. 최소 세트:
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

- [x] **루프 INSERT/UPDATE (왕복 폭증)** ✅ 완료 — 재정렬은 `unnest` 단일 UPDATE로, setTripCities/setTripMembers/expense_splits/seedChecklistPresets는 다중 VALUES 단일 INSERT로 전환.
- [x] **트랜잭션 0회** ✅ 완료 — `db.ts`에 `withTransaction` 헬퍼 추가. 여행 생성/수정, 보관함→일정 변환을 BEGIN/COMMIT으로 묶음. 로컬 Postgres로 배치삽입·트랜잭션 경로 스모크 테스트 통과.
- [ ] **사진 다중 업로드 순차 처리** — `routes.ts:1095-1105`, `1272-1308` 파일마다 sharp 압축→R2 업로드→INSERT를 순차 await. 10장이면 처리시간 ×10. → `Promise.all` + 동시성 제한(3~4개, p-limit)으로 병렬화.
- [ ] **logActivity가 응답 경로에서 await** — `routes.ts:36-41`. 활동 로그는 부가 기능이므로 응답 후 fire-and-forget(catch만)으로 빼면 쓰기 API 지연이 줄어듦.
- [ ] **activity_log 무한 증가** — 보존 정책 없음. 주기적으로 오래된 행 삭제(예: 최근 500개만 유지)하는 정리 쿼리 추가.

### A-3. 서버 구성

- [x] **응답 압축 없음** ✅ 2026-07-16 완료 — `index.ts`에 compression 미들웨어 없음. 타임라인/장소 JSON은 수백 KB까지 커질 수 있고 텍스트라 gzip 효율이 큼. → `compression` 패키지 한 줄 (이미지 스트리밍 라우트는 제외).
- [x] **initSchema가 기동마다 400줄 DDL 재실행** ✅ 완료 — node-pg-migrate로 이관(`server/migrations/`), 기존 SQL 전체를 베이스라인 마이그레이션 1개로 옮김(멱등이라 기존 운영 DB에도 안전). 이후 기동은 `pgmigrations` 테이블로 미적용분만 실행. 로컬에서 (a) 빈 DB (b) 이미 initSchema로 세팅된 기존 DB 두 시나리오 모두 검증.
- [ ] **pg Pool 기본 설정** — `db.ts:3-6`. Neon은 동시 커넥션 제한이 있고 유휴 비용도 있음. → `max`(Railway 단일 인스턴스면 5~10), `idleTimeoutMillis`, `connectionTimeoutMillis` 명시. Neon의 pooled connection string(`-pooler`) 사용 검토. `rejectUnauthorized: false`도 Neon CA 검증으로 바꾸는 것 권장(보안).
- [ ] **프로덕션을 tsx로 구동** — `server/package.json` `start: tsx src/index.ts`. 기동 시간·메모리 오버헤드. → `tsc`로 빌드 후 `node dist/index.js`.
- [ ] **로그인 rate limit 없음** — `routes.ts:233`. 성능이라기보다 보안이지만, 무제한 시도는 DoS 벡터이기도 함. → express-rate-limit + `crypto.timingSafeEqual` 비교.

### A-4. 파일 서빙

- [ ] **모든 이미지가 서버 경유 스트리밍** — `upload.ts:91-104` + `routes.ts:263-266`. 사진 한 장마다 브라우저→Railway(단일 리전)→R2→다시 브라우저. 갤러리 24장이면 Railway가 24번 프록시. `Cache-Control: private`이라 CDN 캐시도 불가. → 단기: 현행 유지(브라우저 immutable 캐시는 이미 있음). 중기: 만료 짧은 **R2 presigned URL**을 API 응답에 포함시켜 브라우저가 R2에서 직접 받게 하거나, Cloudflare Worker 프록시로 엣지 캐시.
- [x] **썸네일 부재** ✅ 완료 — 업로드 시 480px/품질70 썸네일을 `thumb_` 접두사로 함께 생성·업로드. 프론트 `Thumb` 컴포넌트(원본 자동 폴백)로 목록/그리드 12곳 전환, 라이트박스는 원본 유지. 삭제 시(`safeUnlink`) 썸네일도 함께 정리. R2 실접근은 배포 환경에서 최종 확인 필요.

---

## B. 프론트엔드

### B-1. 정적 자산 (즉효)

- [x] **미사용 20.7MB 동영상 배포 중** ✅ 2026-07-16 완료 — `web/public/109821-685694725.mp4`. 코드 어디서도 참조 안 함(전수 grep 확인). 배포 아티팩트만 키움. → 삭제.
- [x] **미사용/중복 이미지 정리** ✅ 2026-07-16 완료 — `file.png`(203KB), `연차계획.png`(77KB), `대지 1_13.png`(131KB), `Purple_..._1_-removebg-preview.png`(171KB), `2.플래너.png`, `3.투두리스트.png`, 웹p 시안들 — 참조되는 것은 `할일목록 v.png` 하나뿐(`TripBaseSection.tsx:501`). → 쓰는 것만 남기고 삭제, 남기는 PNG는 webp로 변환.
- [x] **폰트 로딩** ✅ 2026-07-16 완료 — typeface-nanum-barun-gothic 풀 폰트(400+700 woff2만 3.08MB)를 KS X 1001 한글 2,350자 서브셋 woff2(합계 282KB, **91% 감소**)로 교체해 `web/src/fonts/`에 self-host. `font-display: swap` 적용, 패키지 의존성 제거. 재생성 방법은 `fonts/nanum-barun-gothic.css` 주석 참고.

### B-2. 이미지 렌더링

- [x] **`loading="lazy"` 사용 0곳** ✅ 2026-07-16 완료 — (전수 grep 확인) — 대시보드 갤러리·캘린더, 타임라인 사진, 보관함, 장소 카드의 모든 `<img>`가 즉시 로드. → 목록/그리드 이미지 전부에 `loading="lazy" decoding="async"` 추가. 1시간짜리 작업으로 초기 로드 체감이 가장 크게 바뀌는 항목 중 하나.
- [ ] **원본 크기 이미지를 그리드에 사용** — A-4 썸네일 항목과 짝. 서버 썸네일이 생기면 `fileUrl()`에 variant 파라미터를 추가해 목록 UI에서 사용.
- [ ] **라이트박스 프리로드** — 현재는 열 때 원본 로드. 이전/다음 이미지 1장씩 미리 로드하면 넘김이 부드러워짐 (소규모).

### B-3. 데이터 페칭 구조 (구조적으로 가장 중요)

- [x] **캐시 계층 부재 + 전체 refetch 패턴** ✅ 완료 — TanStack Query 도입(`web/src/queries.ts`). TripWorkspace의 9-엔드포인트 blind refetch를 useQuery 9개 + 리소스별 targeted invalidate로 전환(예: 지출 삭제는 `expenses`만, 이동구간 변경은 `transit`만 무효화). 드래그 재정렬은 `queryClient.setQueryData`로 낙관적 업데이트 유지. App/TripWindow/TripsScreen/Dashboard/Countries/Bucket/Places/TripBaseSection/ArchiveBoard/Expenses/Settlement/Members 등 주요 화면 전환, countries·cities 6곳 중복 fetch 제거. Playwright로 실제 브라우저 렌더·탭 왕복·캐시 재사용 확인(콘솔 에러 0, 페이지 예외 0).
- [x] **공용 데이터 중복 fetch** ✅ 완료 — App/TripWindow/TripsScreen/CountriesScreen/BucketListScreen/PlacesScreen/TripBaseSection 등 countries·cities를 각자 fetch하던 6곳을 `useCountries`/`useCities` 공유 쿼리로 통합. TripCountryCityPicker는 props로 값을 받는 구조라 부모 쪽 통합만으로 캐시 공유됨.
- [ ] **bucket.list() 전역 로드** — `TripWorkspace.tsx:826` 일정 화면에서 버킷 전체를 항상 로드하지만 편집 모달에서만 사용. → 모달 열 때 lazy fetch. (여전히 미해결 — useBucket()으로 캐시는 공유되지만 로드 자체는 여전히 즉시 실행됨)

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
