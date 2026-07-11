import pg from 'pg'

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
})

export async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trips (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date   TEXT NOT NULL,
      budget     DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS members (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS trip_members (
      trip_id   TEXT NOT NULL REFERENCES trips(id)   ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      PRIMARY KEY (trip_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS places (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      address    TEXT NOT NULL DEFAULT '',
      category   TEXT NOT NULL DEFAULT '기타',
      lat        DOUBLE PRECISION,
      lng        DOUBLE PRECISION,
      memo       TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS timeline_events (
      id           TEXT PRIMARY KEY,
      trip_id      TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      place_id     TEXT NOT NULL REFERENCES places(id),
      day_number   INT NOT NULL,
      sequence     INT NOT NULL,
      planned_time TEXT,
      rating       DOUBLE PRECISION,
      review       TEXT,
      must_try     TEXT,
      link_url     TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id          TEXT PRIMARY KEY,
      trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      event_id    TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
      amount      DOUBLE PRECISION NOT NULL,
      currency    TEXT NOT NULL DEFAULT 'KRW',
      category    TEXT NOT NULL DEFAULT '기타',
      description TEXT NOT NULL,
      paid_by     TEXT NOT NULL REFERENCES members(id),
      spent_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expense_splits (
      expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      member_id  TEXT NOT NULL REFERENCES members(id),
      PRIMARY KEY (expense_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id         TEXT PRIMARY KEY,
      trip_id    TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      file_type  TEXT NOT NULL,
      file_path  TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS photos (
      id         TEXT PRIMARY KEY,
      event_id   TEXT NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
      file_path  TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS archive_items (
      id         TEXT PRIMARY KEY,
      trip_id    TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      kind       TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT,
      file_path  TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS day_notes (
      trip_id    TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      day_number INT NOT NULL,
      note       TEXT,
      weather    TEXT,
      PRIMARY KEY (trip_id, day_number)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- ── 국가·도시 족보 ──────────────────────────────────
    CREATE TABLE IF NOT EXISTS countries (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      code              TEXT,
      capital           TEXT,
      phone_code        TEXT,
      currency          TEXT,
      voltage           TEXT,
      language          TEXT,
      visa              TEXT,
      prep_docs         TEXT,
      emergency_police  TEXT,
      emergency_medical TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS cities (
      id              TEXT PRIMARY KEY,
      country_id      TEXT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      flight_duration TEXT,
      time_diff       TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS trip_cities (
      trip_id  TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      city_id  TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
      sequence INT NOT NULL DEFAULT 0,
      PRIMARY KEY (trip_id, city_id)
    );

    -- ── 항공 상세 (공항 이벤트 1:1) ───────────────────────
    CREATE TABLE IF NOT EXISTS flight_details (
      event_id        TEXT PRIMARY KEY REFERENCES timeline_events(id) ON DELETE CASCADE,
      depart_at       TEXT,
      arrive_at       TEXT,
      duration_minutes INT,
      booking_ref     TEXT,
      booked_via      TEXT
    );

    -- ── 여행별 고정 환율 ──────────────────────────────────
    CREATE TABLE IF NOT EXISTS trip_currency_rates (
      trip_id      TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      currency     TEXT NOT NULL,
      krw_per_unit DOUBLE PRECISION NOT NULL,
      PRIMARY KEY (trip_id, currency)
    );

    -- ── 체크리스트 (일차별 할일 / 준비물 / 쇼핑 / 음식 공용) ─
    CREATE TABLE IF NOT EXISTS checklist_items (
      id         TEXT PRIMARY KEY,
      trip_id    TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      scope      TEXT NOT NULL CHECK (scope IN ('day', 'packing', 'shopping', 'food')),
      day_number INT,
      text       TEXT NOT NULL,
      done       BOOLEAN NOT NULL DEFAULT false,
      sequence   INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- ── 버킷리스트 ────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS bucket_items (
      id             TEXT PRIMARY KEY,
      title          TEXT NOT NULL,
      memo           TEXT,
      country_id     TEXT REFERENCES countries(id) ON DELETE SET NULL,
      city_id        TEXT REFERENCES cities(id) ON DELETE SET NULL,
      category       TEXT,
      done           BOOLEAN NOT NULL DEFAULT false,
      linked_trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE trips ADD COLUMN IF NOT EXISTS budget DOUBLE PRECISION NOT NULL DEFAULT 0;
    ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS must_try TEXT;
    ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS planned_time TEXT;
    ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS link_url TEXT;
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL;
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '기타';
    ALTER TABLE day_notes ADD COLUMN IF NOT EXISTS diary TEXT;
    ALTER TABLE day_notes ADD COLUMN IF NOT EXISTS weather_emoji TEXT;
    ALTER TABLE day_notes ADD COLUMN IF NOT EXISTS weather_temp INT;
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method TEXT;
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS memo TEXT;
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS purchase_items TEXT;
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_prebooked BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS map_url TEXT;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS pros TEXT;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS cons TEXT;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS country_id TEXT REFERENCES countries(id) ON DELETE SET NULL;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS city_id TEXT REFERENCES cities(id) ON DELETE SET NULL;

    -- ── 동선 이동 구간 (지하철/도보/기차 등, 특정 일정 뒤에 표시) ─
    CREATE TABLE IF NOT EXISTS transit_segments (
      id             TEXT PRIMARY KEY,
      trip_id        TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      day_number     INT NOT NULL,
      after_event_id TEXT REFERENCES timeline_events(id) ON DELETE CASCADE,
      mode           TEXT NOT NULL,
      duration_text  TEXT,
      voucher_id     TEXT REFERENCES vouchers(id) ON DELETE SET NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE transit_segments ADD COLUMN IF NOT EXISTS note TEXT;
    ALTER TABLE bucket_items ADD COLUMN IF NOT EXISTS linked_place_id TEXT REFERENCES places(id) ON DELETE SET NULL;
    ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS bucket_item_id TEXT REFERENCES bucket_items(id) ON DELETE SET NULL;
    ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS memo TEXT;

    -- 보관함 항목을 여행에 종속시키지 않고도(SNS에서 저장만 해둔 링크 등) 만들 수 있게 함
    ALTER TABLE archive_items ALTER COLUMN trip_id DROP NOT NULL;
    ALTER TABLE archive_items ADD COLUMN IF NOT EXISTS linked_place_id TEXT REFERENCES places(id) ON DELETE SET NULL;

    -- 장소 족보 보강: 영업시간·예약필요·추천메뉴
    ALTER TABLE places ADD COLUMN IF NOT EXISTS hours TEXT;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS reservation_needed BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS recommended_menu TEXT;

    -- 항공 상세 보강: 탑승 위치·확정 여부·연결된 바우처
    ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS departure_location TEXT;
    ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS voucher_id TEXT REFERENCES vouchers(id) ON DELETE SET NULL;

    -- 일차별로 어느 도시에 해당하는지 명시적으로 지정 가능하게(자동 추론 대신/보완) — 하루에 여러 도시 가능
    ALTER TABLE day_notes ADD COLUMN IF NOT EXISTS city_id TEXT REFERENCES cities(id) ON DELETE SET NULL;
    ALTER TABLE day_notes ADD COLUMN IF NOT EXISTS city_ids TEXT[] NOT NULL DEFAULT '{}';

    -- 체크리스트: 준비물 안에서 필수/선택/당일준비물로 묶고, '여행 전 Todo' 범위 추가
    ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE checklist_items DROP CONSTRAINT IF EXISTS checklist_items_scope_check;
    ALTER TABLE checklist_items ADD CONSTRAINT checklist_items_scope_check
      CHECK (scope IN ('day', 'packing', 'shopping', 'food', 'predeparture'));

    -- 바우처를 항공권/숙소/티켓 등으로 구분
    ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '기타';

    -- '식당' 분류명을 '맛집'으로 통일
    UPDATE places SET category = '맛집' WHERE category = '식당';

    -- 버킷리스트 항목 하나가 여러 국가·도시에 걸칠 수 있게(먹킷/위시 모두 여러 지역에서 유명할 수 있으므로)
    ALTER TABLE bucket_items ADD COLUMN IF NOT EXISTS country_ids TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE bucket_items ADD COLUMN IF NOT EXISTS city_ids TEXT[] NOT NULL DEFAULT '{}';
    UPDATE bucket_items SET country_ids = ARRAY[country_id] WHERE country_id IS NOT NULL AND country_ids = '{}';
    UPDATE bucket_items SET city_ids = ARRAY[city_id] WHERE city_id IS NOT NULL AND city_ids = '{}';

    -- 일차별 하루 예산(설정하면 TODAY 카드에서 지출 대비 상태 등급을 보여줌)
    ALTER TABLE day_notes ADD COLUMN IF NOT EXISTS budget DOUBLE PRECISION;

    -- 버킷리스트 항목에 직접 참고 이미지를 올려둘 수 있게(아직 안 가본 곳은 장소 족보에 방문 사진이 없으므로)
    ALTER TABLE bucket_items ADD COLUMN IF NOT EXISTS image_path TEXT;

    -- 맛집 브레이크타임(점심·저녁 사이 휴식 시간)
    ALTER TABLE places ADD COLUMN IF NOT EXISTS break_time TEXT;

    -- 항공권을 탑승권 카드 형태로 보여주기 위한 정보
    ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS airline TEXT;
    ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS airline_logo_path TEXT;
    ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS flight_no TEXT;
    ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS destination TEXT;
    ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS gate TEXT;
    ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS seat TEXT;
    ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS flight_class TEXT;

    -- 업로드 저장 경로와 DB 기록 경로가 어긋났던 과거 버그로 깨진 file_path 복구
    -- (실제 파일은 photos/vouchers/archive 하위에 평평하게 저장되어 있었음)
    UPDATE photos SET file_path = 'photos/' || split_part(file_path, '/', 3)
      WHERE file_path LIKE 'photos/%/%';
    UPDATE vouchers SET file_path = 'vouchers/' || split_part(file_path, '/', 3)
      WHERE file_path LIKE 'vouchers/%/%';
    UPDATE archive_items SET file_path = 'archive/' || split_part(file_path, '/', 3)
      WHERE kind = 'image' AND file_path LIKE 'archive/%/%';
  `)
}
