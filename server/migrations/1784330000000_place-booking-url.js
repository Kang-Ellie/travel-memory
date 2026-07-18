export const shorthands = undefined

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE places ADD COLUMN IF NOT EXISTS booking_url TEXT;`)
}

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE places DROP COLUMN IF EXISTS booking_url;`)
}
