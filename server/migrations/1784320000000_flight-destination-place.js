export const shorthands = undefined

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS destination_place_id TEXT REFERENCES places(id) ON DELETE SET NULL;`)
}

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE flight_details DROP COLUMN IF EXISTS destination_place_id;`)
}
