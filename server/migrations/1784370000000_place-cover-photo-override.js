export const shorthands = undefined

export const up = (pgm) => {
  // 지금까지는 "첫 방문의 첫 사진"이 자동으로 대표사진이었는데, 직접 고를 수 있게
  // 오버라이드 컬럼을 추가한다 — 값이 있으면 그걸 쓰고, 없으면 기존 자동 계산으로 폴백.
  pgm.sql(`ALTER TABLE places ADD COLUMN IF NOT EXISTS cover_photo_override TEXT;`)
}

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE places DROP COLUMN IF EXISTS cover_photo_override;`)
}
