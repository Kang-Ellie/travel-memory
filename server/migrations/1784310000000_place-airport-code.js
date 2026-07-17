export const shorthands = undefined

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE places ADD COLUMN IF NOT EXISTS airport_code TEXT;`)
}

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE places DROP COLUMN IF EXISTS airport_code;`)
}
