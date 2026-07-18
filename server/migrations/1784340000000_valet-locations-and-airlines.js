export const shorthands = undefined

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE places ADD COLUMN IF NOT EXISTS valet_dropoff_location TEXT;`)
  pgm.sql(`ALTER TABLE places ADD COLUMN IF NOT EXISTS valet_return_location TEXT;`)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS airlines (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      logo_path  TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)
  pgm.sql(`ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS airline_id TEXT REFERENCES airlines(id) ON DELETE SET NULL;`)
}

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE flight_details DROP COLUMN IF EXISTS airline_id;`)
  pgm.sql(`DROP TABLE IF EXISTS airlines;`)
  pgm.sql(`ALTER TABLE places DROP COLUMN IF EXISTS valet_dropoff_location;`)
  pgm.sql(`ALTER TABLE places DROP COLUMN IF EXISTS valet_return_location;`)
}
