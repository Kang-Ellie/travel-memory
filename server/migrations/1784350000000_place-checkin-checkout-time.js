export const shorthands = undefined

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE places ADD COLUMN IF NOT EXISTS check_in_time TEXT;`)
  pgm.sql(`ALTER TABLE places ADD COLUMN IF NOT EXISTS check_out_time TEXT;`)
}

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE places DROP COLUMN IF EXISTS check_in_time;`)
  pgm.sql(`ALTER TABLE places DROP COLUMN IF EXISTS check_out_time;`)
}
