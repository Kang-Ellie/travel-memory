// 숙소 카테고리 장소에 호텔/호스텔/에어비앤비 같은 숙소 유형을 저장할 컬럼 추가.
// 성급(grade)은 이미 있었는데 정작 화면 어디에도 안 보여주던 버그와 함께 고침
// (프론트: PlaceMeta·LodgingPassCard).

export const shorthands = undefined

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE places ADD COLUMN IF NOT EXISTS stay_type TEXT;`)
}

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE places DROP COLUMN IF EXISTS stay_type;`)
}
