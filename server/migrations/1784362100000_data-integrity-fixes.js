export const shorthands = undefined

export const up = (pgm) => {
  // 이벤트를 지우면 지출의 event_id가 SET NULL 되면서 그 지출이 어느 장소 것이었는지
  // 끊겨 장소 족보 누적 지출 집계에서 조용히 빠지던 문제 — place_id를 비정규화로 따로
  // 저장해두면 이벤트가 사라져도 장소 연결이 유지된다.
  pgm.sql(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS place_id TEXT REFERENCES places(id) ON DELETE SET NULL;`)
  pgm.sql(`
    UPDATE expenses e SET place_id = te.place_id
    FROM timeline_events te
    WHERE e.event_id = te.id AND e.place_id IS NULL
  `)

  // 이동 구간이 그 뒤에 붙은 일정이 지워질 때 CASCADE로 통째로 같이 사라지던 문제 —
  // 라우트에서 앞 일정으로 재연결하는 게 우선이지만, DB 차원에서도 유실 대신 "일차 시작
  // 지점"(NULL)으로 안전하게 남도록 SET NULL로 바꾼다.
  pgm.sql(`ALTER TABLE transit_segments DROP CONSTRAINT IF EXISTS transit_segments_after_event_id_fkey;`)
  pgm.sql(`
    ALTER TABLE transit_segments
      ADD CONSTRAINT transit_segments_after_event_id_fkey
      FOREIGN KEY (after_event_id) REFERENCES timeline_events(id) ON DELETE SET NULL;
  `)
}

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE transit_segments DROP CONSTRAINT IF EXISTS transit_segments_after_event_id_fkey;`)
  pgm.sql(`
    ALTER TABLE transit_segments
      ADD CONSTRAINT transit_segments_after_event_id_fkey
      FOREIGN KEY (after_event_id) REFERENCES timeline_events(id) ON DELETE CASCADE;
  `)
  pgm.sql(`ALTER TABLE expenses DROP COLUMN IF EXISTS place_id;`)
}
