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

    ALTER TABLE trips ADD COLUMN IF NOT EXISTS budget DOUBLE PRECISION NOT NULL DEFAULT 0;
    ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS must_try TEXT;
    ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS planned_time TEXT;
    ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS link_url TEXT;
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS event_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL;
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '기타';
    ALTER TABLE day_notes ADD COLUMN IF NOT EXISTS diary TEXT;
    ALTER TABLE day_notes ADD COLUMN IF NOT EXISTS weather_emoji TEXT;
    ALTER TABLE day_notes ADD COLUMN IF NOT EXISTS weather_temp INT;

    -- '식당' 분류명을 '맛집'으로 통일
    UPDATE places SET category = '맛집' WHERE category = '식당';

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
