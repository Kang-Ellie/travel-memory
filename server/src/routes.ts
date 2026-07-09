import crypto from 'node:crypto'
import path from 'node:path'
import type { Express as ExpressApp, Request, Response, NextFunction } from 'express'
import { pool } from './db.js'
import { makeUploader, relativeFilePath, safeUnlink, absoluteFromRelative, UPLOAD_DIR } from './upload.js'
import { requireAuth, makeSessionToken, verifySessionToken, cookieOptions, SESSION_COOKIE } from './auth.js'

const id = (): string => crypto.randomUUID()

// async 라우트 핸들러에서 던진(reject된) 에러를 자동으로 next(err)로 넘겨서
// unhandled rejection으로 인한 프로세스 크래시(Node 22 기본 동작)를 막는다.
// app.get/post/put/delete를 몽키패치해서 개별 핸들러마다 try/catch를 붙이지 않아도 되게 함.
function installAsyncErrorHandling(app: ExpressApp): void {
  for (const method of ['get', 'post', 'put', 'delete'] as const) {
    const original = (app as any)[method].bind(app)
    ;(app as any)[method] = (routePath: string, ...handlers: any[]) => {
      const wrapped = handlers.map((h) => {
        if (typeof h !== 'function') return h
        return (req: Request, res: Response, next: NextFunction) => {
          try {
            Promise.resolve(h(req, res, next)).catch(next)
          } catch (err) {
            next(err)
          }
        }
      })
      return original(routePath, ...wrapped)
    }
  }
}

const photoUploader = makeUploader('photos')
const voucherUploader = makeUploader('vouchers')
const archiveUploader = makeUploader('archive')

// ── 행 매핑 (snake_case DB → camelCase API) ──────────────
const mapTrip = (r: any) => ({
  id: r.id, title: r.title, startDate: r.start_date, endDate: r.end_date,
  budget: Number(r.budget), createdAt: r.created_at,
  cities: (r.cities ?? []) as Array<{ id: string; name: string; countryName: string; countryCode: string | null }>,
})
const mapMember = (r: any) => ({ id: r.id, name: r.name })
const mapPlace = (r: any) => ({
  id: r.id, name: r.name, address: r.address, category: r.category,
  lat: r.lat != null ? Number(r.lat) : null, lng: r.lng != null ? Number(r.lng) : null,
  memo: r.memo, mapUrl: r.map_url, rating: r.rating != null ? Number(r.rating) : null,
  pros: r.pros, cons: r.cons, countryId: r.country_id, cityId: r.city_id,
  countryName: r.country_name ?? null, countryCode: r.country_code ?? null, cityName: r.city_name ?? null,
  createdAt: r.created_at,
})
const mapTransit = (r: any) => ({
  id: r.id, tripId: r.trip_id, dayNumber: r.day_number, afterEventId: r.after_event_id,
  mode: r.mode, durationText: r.duration_text, note: r.note, voucherId: r.voucher_id,
  voucherTitle: r.voucher_title ?? null, createdAt: r.created_at,
})
const mapFlightDetail = (r: any) => ({
  departAt: r.depart_at, arriveAt: r.arrive_at,
  durationMinutes: r.duration_minutes != null ? Number(r.duration_minutes) : null,
  bookingRef: r.booking_ref, bookedVia: r.booked_via,
})
const mapEvent = (r: any) => ({
  id: r.id, tripId: r.trip_id, placeId: r.place_id, dayNumber: r.day_number, sequence: r.sequence,
  plannedTime: r.planned_time, rating: r.rating != null ? Number(r.rating) : null,
  review: r.review, mustTry: r.must_try, linkUrl: r.link_url, createdAt: r.created_at,
})
const mapExpense = (r: any) => ({
  id: r.id, tripId: r.trip_id, eventId: r.event_id, amount: Number(r.amount), currency: r.currency,
  category: r.category, description: r.description, paidBy: r.paid_by, payerName: r.payer_name,
  spentAt: r.spent_at, paymentMethod: r.payment_method, memo: r.memo, purchaseItems: r.purchase_items,
  isShared: r.is_shared, isPrebooked: r.is_prebooked,
})
const mapVoucher = (r: any) => ({
  id: r.id, tripId: r.trip_id, title: r.title, fileType: r.file_type, filePath: r.file_path, createdAt: r.created_at,
})
const mapPhoto = (r: any) => ({ id: r.id, eventId: r.event_id, filePath: r.file_path })
const mapArchive = (r: any) => ({
  id: r.id, tripId: r.trip_id, kind: r.kind, title: r.title, body: r.body, filePath: r.file_path, createdAt: r.created_at,
})
const mapCountry = (r: any) => ({
  id: r.id, name: r.name, code: r.code, capital: r.capital, phoneCode: r.phone_code,
  currency: r.currency, voltage: r.voltage, language: r.language, visa: r.visa,
  prepDocs: r.prep_docs, emergencyPolice: r.emergency_police, emergencyMedical: r.emergency_medical,
  createdAt: r.created_at,
})
const mapCity = (r: any) => ({
  id: r.id, countryId: r.country_id, name: r.name, flightDuration: r.flight_duration,
  timeDiff: r.time_diff, createdAt: r.created_at, visited: !!r.visited,
})
const mapChecklist = (r: any) => ({
  id: r.id, tripId: r.trip_id, scope: r.scope, dayNumber: r.day_number, text: r.text,
  done: r.done, sequence: r.sequence, createdAt: r.created_at,
})
const mapBucket = (r: any) => ({
  id: r.id, title: r.title, memo: r.memo, countryId: r.country_id, cityId: r.city_id,
  countryName: r.country_name ?? null, cityName: r.city_name ?? null,
  category: r.category, done: r.done, linkedTripId: r.linked_trip_id,
  linkedTripTitle: r.linked_trip_title ?? null, createdAt: r.created_at,
})

const TRIP_CITIES_SUBQUERY = `
  COALESCE((
    SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'countryName', co.name, 'countryCode', co.code) ORDER BY tc.sequence)
    FROM trip_cities tc JOIN cities c ON c.id = tc.city_id JOIN countries co ON co.id = c.country_id
    WHERE tc.trip_id = t.id
  ), '[]'::json) AS cities
`

async function setTripCities(tripId: string, cityIds: string[]): Promise<void> {
  await pool.query('DELETE FROM trip_cities WHERE trip_id = $1', [tripId])
  for (let i = 0; i < (cityIds ?? []).length; i++) {
    await pool.query('INSERT INTO trip_cities (trip_id, city_id, sequence) VALUES ($1,$2,$3)', [tripId, cityIds[i], i])
  }
}

export function registerRoutes(app: ExpressApp): void {
  installAsyncErrorHandling(app)

  // ── 인증 ──────────────────────────────────────────────
  app.post('/api/login', (req: Request, res: Response) => {
    const passcode = (req.body?.passcode ?? '') as string
    if (!process.env.APP_PASSCODE) {
      res.status(500).json({ error: 'APP_PASSCODE 환경변수가 서버에 설정되지 않았어요.' })
      return
    }
    if (passcode !== process.env.APP_PASSCODE) {
      res.status(401).json({ error: '비밀번호가 틀렸어요.' })
      return
    }
    res.cookie(SESSION_COOKIE, makeSessionToken(), cookieOptions())
    res.json({ ok: true })
  })

  app.post('/api/logout', (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE)
    res.json({ ok: true })
  })

  app.get('/api/session', (req: Request, res: Response) => {
    res.json({ authed: verifySessionToken((req as any).cookies?.[SESSION_COOKIE]) })
  })

  const api = app // alias, all routes below require auth
  api.use('/api', (req, res, next) => {
    if (req.path === '/login' || req.path === '/logout' || req.path === '/session') { next(); return }
    requireAuth(req, res, next)
  })

  // ── 파일 서빙 ─────────────────────────────────────────
  app.get('/api/files/*', (req: Request, res: Response) => {
    const rel = (req.params as any)[0] as string
    const abs = path.resolve(absoluteFromRelative(rel))
    if (!abs.startsWith(path.resolve(UPLOAD_DIR))) { res.status(400).end(); return }
    res.sendFile(abs, (err) => { if (err) res.status(404).end() })
  })

  // ── 여행 ──────────────────────────────────────────────
  app.get('/api/trips', async (_req, res) => {
    const r = await pool.query(`SELECT t.*, ${TRIP_CITIES_SUBQUERY} FROM trips t ORDER BY t.start_date DESC`)
    res.json(r.rows.map(mapTrip))
  })

  app.post('/api/trips', async (req, res) => {
    const { title, startDate, endDate, budget, memberIds, cityIds } = req.body as {
      title: string; startDate: string; endDate: string; budget: number; memberIds: string[]; cityIds: string[]
    }
    const tripId = id()
    await pool.query('INSERT INTO trips (id, title, start_date, end_date, budget) VALUES ($1,$2,$3,$4,$5)',
      [tripId, title, startDate, endDate, budget ?? 0])
    for (const m of memberIds ?? []) {
      await pool.query('INSERT INTO trip_members (trip_id, member_id) VALUES ($1,$2)', [tripId, m])
    }
    await setTripCities(tripId, cityIds)
    const r = await pool.query(`SELECT t.*, ${TRIP_CITIES_SUBQUERY} FROM trips t WHERE t.id = $1`, [tripId])
    res.json(mapTrip(r.rows[0]))
  })

  app.put('/api/trips/:id', async (req, res) => {
    const { title, startDate, endDate, budget, cityIds } = req.body as {
      title: string; startDate: string; endDate: string; budget: number; cityIds: string[]
    }
    await pool.query('UPDATE trips SET title=$1, start_date=$2, end_date=$3, budget=$4 WHERE id=$5',
      [title, startDate, endDate, budget ?? 0, req.params.id])
    await setTripCities(req.params.id, cityIds)
    res.json({ ok: true })
  })

  app.delete('/api/trips/:id', async (req, res) => {
    await pool.query('DELETE FROM trips WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  })

  // ── 동행인 ────────────────────────────────────────────
  app.get('/api/members', async (_req, res) => {
    const r = await pool.query('SELECT * FROM members ORDER BY name')
    res.json(r.rows.map(mapMember))
  })

  app.post('/api/members', async (req, res) => {
    const name = ((req.body?.name ?? '') as string).trim()
    try {
      const memberId = id()
      await pool.query('INSERT INTO members (id, name) VALUES ($1,$2)', [memberId, name])
      res.json({ id: memberId, name })
    } catch {
      res.json({ error: '이미 같은 이름의 동행인이 있어요.' })
    }
  })

  app.delete('/api/members/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM members WHERE id = $1', [req.params.id])
      res.json({})
    } catch {
      res.json({ error: '가계부 기록에서 사용 중인 동행인이라 삭제할 수 없어요.' })
    }
  })

  app.get('/api/trips/:tripId/members', async (req, res) => {
    const r = await pool.query(
      `SELECT m.* FROM members m JOIN trip_members tm ON tm.member_id = m.id
       WHERE tm.trip_id = $1 ORDER BY m.name`, [req.params.tripId])
    res.json(r.rows.map(mapMember))
  })

  app.put('/api/trips/:tripId/members', async (req, res) => {
    const memberIds = (req.body?.memberIds ?? []) as string[]
    await pool.query('DELETE FROM trip_members WHERE trip_id = $1', [req.params.tripId])
    for (const m of memberIds) {
      await pool.query('INSERT INTO trip_members (trip_id, member_id) VALUES ($1,$2)', [req.params.tripId, m])
    }
    res.json({ ok: true })
  })

  // ── 장소 족보 ─────────────────────────────────────────
  const PLACE_SELECT = `
    SELECT p.*, co.name AS country_name, co.code AS country_code, ci.name AS city_name
    FROM places p
    LEFT JOIN countries co ON co.id = p.country_id
    LEFT JOIN cities ci ON ci.id = p.city_id
  `

  app.get('/api/places', async (_req, res) => {
    const r = await pool.query(`${PLACE_SELECT} ORDER BY p.created_at DESC`)
    res.json(r.rows.map(mapPlace))
  })

  app.post('/api/places', async (req, res) => {
    const {
      name, address, category, lat, lng, memo, mapUrl, rating, pros, cons, countryId, cityId,
    } = req.body as {
      name: string; address: string; category: string; lat?: number | null; lng?: number | null
      memo?: string | null; mapUrl?: string | null; rating?: number | null
      pros?: string | null; cons?: string | null; countryId?: string | null; cityId?: string | null
    }
    const placeId = id()
    await pool.query(
      `INSERT INTO places (id, name, address, category, lat, lng, memo, map_url, rating, pros, cons, country_id, city_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [placeId, name.trim(), (address ?? '').trim(), category, lat ?? null, lng ?? null, memo ?? null,
        mapUrl?.trim() || null, rating ?? null, pros?.trim() || null, cons?.trim() || null,
        countryId || null, cityId || null])
    const r = await pool.query(`${PLACE_SELECT} WHERE p.id = $1`, [placeId])
    res.json(mapPlace(r.rows[0]))
  })

  app.put('/api/places/:id', async (req, res) => {
    const {
      name, address, category, memo, mapUrl, rating, pros, cons, countryId, cityId,
    } = req.body as {
      name: string; address: string; category: string; memo: string | null; mapUrl: string | null
      rating: number | null; pros: string | null; cons: string | null
      countryId: string | null; cityId: string | null
    }
    await pool.query(
      `UPDATE places SET name=$1, address=$2, category=$3, memo=$4, map_url=$5, rating=$6, pros=$7, cons=$8,
         country_id=$9, city_id=$10 WHERE id=$11`,
      [name.trim(), (address ?? '').trim(), category, memo, mapUrl?.trim() || null, rating ?? null,
        pros?.trim() || null, cons?.trim() || null, countryId || null, cityId || null, req.params.id])
    res.json({ ok: true })
  })

  app.delete('/api/places/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM places WHERE id = $1', [req.params.id])
      res.json({})
    } catch {
      res.json({ error: '여행 동선에서 사용 중인 장소라 삭제할 수 없어요.' })
    }
  })

  // 장소 족보 상세 — 여러 여행에 걸친 방문 기록·리뷰·사진·누적 비용을 한 번에
  app.get('/api/places/:id/detail', async (req, res) => {
    const placeId = req.params.id
    const placeRow = await pool.query(`${PLACE_SELECT} WHERE p.id = $1`, [placeId])
    if (placeRow.rows.length === 0) { res.status(404).json({ error: '장소를 찾을 수 없어요.' }); return }

    const events = await pool.query(
      `SELECT te.*, t.title AS trip_title FROM timeline_events te
       JOIN trips t ON t.id = te.trip_id
       WHERE te.place_id = $1 ORDER BY t.start_date DESC, te.day_number, te.sequence`, [placeId])

    const visits = []
    for (const ev of events.rows) {
      const photos = await pool.query('SELECT * FROM photos WHERE event_id = $1 ORDER BY created_at', [ev.id])
      const flight = await pool.query('SELECT * FROM flight_details WHERE event_id = $1', [ev.id])
      visits.push({
        ...mapEvent(ev), tripTitle: ev.trip_title, photos: photos.rows.map(mapPhoto),
        flight: flight.rows[0] ? mapFlightDetail(flight.rows[0]) : null,
      })
    }

    const totals = await pool.query(
      `SELECT currency, SUM(amount) AS total FROM expenses
       WHERE event_id IN (SELECT id FROM timeline_events WHERE place_id = $1)
       GROUP BY currency`, [placeId])

    res.json({
      place: mapPlace(placeRow.rows[0]),
      visits,
      expenseTotals: totals.rows.map((t) => ({ currency: t.currency, total: Number(t.total) })),
    })
  })

  app.get('/api/places/google-search', async (req, res) => {
    const query = (req.query.q ?? '') as string
    const keyRow = await pool.query("SELECT value FROM settings WHERE key = 'googleApiKey'")
    const key = keyRow.rows[0]?.value?.trim()
    if (!key) { res.json({ error: '설정에서 구글 API 키를 먼저 등록해주세요.' }); return }
    try {
      const gr = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask':
            'places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.rating',
        },
        body: JSON.stringify({ textQuery: query, languageCode: 'ko' }),
      })
      if (!gr.ok) {
        const body = await gr.text()
        res.json({ error: `구글 응답 오류 (${gr.status}): ${body.slice(0, 300)}` })
        return
      }
      const json = (await gr.json()) as { places?: any[] }
      res.json((json.places ?? []).map((p) => ({
        name: p.displayName?.text ?? '(이름 없음)',
        address: p.formattedAddress ?? '',
        lat: p.location?.latitude ?? 0,
        lng: p.location?.longitude ?? 0,
        category: p.primaryTypeDisplayName?.text ?? '기타',
        googleRating: p.rating ?? null,
      })))
    } catch (err) {
      res.json({ error: `검색 실패 (서버 인터넷 연결을 확인해주세요): ${String(err)}` })
    }
  })

  // ── 국가·도시 족보 ────────────────────────────────────
  app.get('/api/countries', async (_req, res) => {
    const r = await pool.query('SELECT * FROM countries ORDER BY name')
    res.json(r.rows.map(mapCountry))
  })

  app.post('/api/countries', async (req, res) => {
    const {
      name, code, capital, phoneCode, currency, voltage, language, visa, prepDocs, emergencyPolice, emergencyMedical,
    } = req.body as {
      name: string; code: string | null; capital: string | null; phoneCode: string | null; currency: string | null
      voltage: string | null; language: string | null; visa: string | null; prepDocs: string | null
      emergencyPolice: string | null; emergencyMedical: string | null
    }
    const countryId = id()
    await pool.query(
      `INSERT INTO countries (id, name, code, capital, phone_code, currency, voltage, language, visa, prep_docs, emergency_police, emergency_medical)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [countryId, name.trim(), code, capital, phoneCode, currency, voltage, language, visa, prepDocs, emergencyPolice, emergencyMedical])
    const r = await pool.query('SELECT * FROM countries WHERE id = $1', [countryId])
    res.json(mapCountry(r.rows[0]))
  })

  app.put('/api/countries/:id', async (req, res) => {
    const {
      name, code, capital, phoneCode, currency, voltage, language, visa, prepDocs, emergencyPolice, emergencyMedical,
    } = req.body as {
      name: string; code: string | null; capital: string | null; phoneCode: string | null; currency: string | null
      voltage: string | null; language: string | null; visa: string | null; prepDocs: string | null
      emergencyPolice: string | null; emergencyMedical: string | null
    }
    await pool.query(
      `UPDATE countries SET name=$1, code=$2, capital=$3, phone_code=$4, currency=$5, voltage=$6, language=$7,
         visa=$8, prep_docs=$9, emergency_police=$10, emergency_medical=$11 WHERE id=$12`,
      [name.trim(), code, capital, phoneCode, currency, voltage, language, visa, prepDocs, emergencyPolice, emergencyMedical, req.params.id])
    res.json({ ok: true })
  })

  app.delete('/api/countries/:id', async (req, res) => {
    await pool.query('DELETE FROM countries WHERE id = $1', [req.params.id])
    res.json({})
  })

  const CITY_SELECT = `
    SELECT c.*, EXISTS(
      SELECT 1 FROM trip_cities tc JOIN trips t ON t.id = tc.trip_id
      WHERE tc.city_id = c.id AND t.end_date < to_char(CURRENT_DATE, 'YYYY-MM-DD')
    ) AS visited
    FROM cities c
  `

  app.get('/api/cities', async (_req, res) => {
    const r = await pool.query(`${CITY_SELECT} ORDER BY c.name`)
    res.json(r.rows.map(mapCity))
  })

  app.post('/api/cities', async (req, res) => {
    const { countryId, name, flightDuration, timeDiff } = req.body as {
      countryId: string; name: string; flightDuration: string | null; timeDiff: string | null
    }
    const cityId = id()
    await pool.query('INSERT INTO cities (id, country_id, name, flight_duration, time_diff) VALUES ($1,$2,$3,$4,$5)',
      [cityId, countryId, name.trim(), flightDuration, timeDiff])
    const r = await pool.query(`${CITY_SELECT} WHERE c.id = $1`, [cityId])
    res.json(mapCity(r.rows[0]))
  })

  app.put('/api/cities/:id', async (req, res) => {
    const { name, flightDuration, timeDiff } = req.body as { name: string; flightDuration: string | null; timeDiff: string | null }
    await pool.query('UPDATE cities SET name=$1, flight_duration=$2, time_diff=$3 WHERE id=$4',
      [name.trim(), flightDuration, timeDiff, req.params.id])
    res.json({ ok: true })
  })

  app.delete('/api/cities/:id', async (req, res) => {
    await pool.query('DELETE FROM cities WHERE id = $1', [req.params.id])
    res.json({})
  })

  // ── 동선(타임라인) ────────────────────────────────────
  async function loadEvents(tripId: string) {
    const events = await pool.query('SELECT * FROM timeline_events WHERE trip_id = $1 ORDER BY day_number, sequence', [tripId])
    const out = []
    for (const ev of events.rows) {
      const place = await pool.query('SELECT * FROM places WHERE id = $1', [ev.place_id])
      const photos = await pool.query('SELECT * FROM photos WHERE event_id = $1 ORDER BY created_at', [ev.id])
      const flight = await pool.query('SELECT * FROM flight_details WHERE event_id = $1', [ev.id])
      out.push({
        ...mapEvent(ev), place: mapPlace(place.rows[0]), photos: photos.rows.map(mapPhoto),
        flight: flight.rows[0] ? mapFlightDetail(flight.rows[0]) : null,
      })
    }
    return out
  }

  app.get('/api/trips/:tripId/events', async (req, res) => {
    res.json(await loadEvents(req.params.tripId))
  })

  app.post('/api/trips/:tripId/events', async (req, res) => {
    const { placeId, dayNumber } = req.body as { placeId: string; dayNumber: number }
    const max = await pool.query(
      'SELECT COALESCE(MAX(sequence), 0) AS m FROM timeline_events WHERE trip_id = $1 AND day_number = $2',
      [req.params.tripId, dayNumber])
    const eventId = id()
    await pool.query(
      'INSERT INTO timeline_events (id, trip_id, place_id, day_number, sequence) VALUES ($1,$2,$3,$4,$5)',
      [eventId, req.params.tripId, placeId, dayNumber, Number(max.rows[0].m) + 1])
    res.json({ id: eventId })
  })

  app.put('/api/events/:id', async (req, res) => {
    const { rating, review, linkUrl, mustTry, plannedTime } = req.body as {
      rating: number | null; review: string | null; linkUrl: string | null; mustTry: string | null; plannedTime: string | null
    }
    await pool.query(
      'UPDATE timeline_events SET rating=$1, review=$2, link_url=$3, must_try=$4, planned_time=$5 WHERE id=$6',
      [rating, review, linkUrl, mustTry, plannedTime, req.params.id])
    res.json({ ok: true })
  })

  app.post('/api/trips/:tripId/events/reorder', async (req, res) => {
    const { dayNumber, orderedIds } = req.body as { dayNumber: number; orderedIds: string[] }
    for (let i = 0; i < orderedIds.length; i++) {
      await pool.query(
        'UPDATE timeline_events SET sequence=$1 WHERE id=$2 AND trip_id=$3 AND day_number=$4',
        [i + 1, orderedIds[i], req.params.tripId, dayNumber])
    }
    res.json({ ok: true })
  })

  app.delete('/api/events/:id', async (req, res) => {
    await pool.query('DELETE FROM timeline_events WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  })

  // ── 항공 상세 (공항 이벤트 1:1) ────────────────────────
  app.put('/api/events/:id/flight', async (req, res) => {
    const { departAt, arriveAt, durationMinutes, bookingRef, bookedVia } = req.body as {
      departAt: string | null; arriveAt: string | null; durationMinutes: number | null
      bookingRef: string | null; bookedVia: string | null
    }
    await pool.query(
      `INSERT INTO flight_details (event_id, depart_at, arrive_at, duration_minutes, booking_ref, booked_via)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (event_id) DO UPDATE SET
         depart_at = excluded.depart_at, arrive_at = excluded.arrive_at, duration_minutes = excluded.duration_minutes,
         booking_ref = excluded.booking_ref, booked_via = excluded.booked_via`,
      [req.params.id, departAt, arriveAt, durationMinutes, bookingRef, bookedVia])
    res.json({ ok: true })
  })

  app.delete('/api/events/:id/flight', async (req, res) => {
    await pool.query('DELETE FROM flight_details WHERE event_id = $1', [req.params.id])
    res.json({ ok: true })
  })

  // ── 동선 이동 구간(교통) ───────────────────────────────
  const TRANSIT_SELECT = `
    SELECT ts.*, v.title AS voucher_title
    FROM transit_segments ts
    LEFT JOIN vouchers v ON v.id = ts.voucher_id
  `

  app.get('/api/trips/:tripId/transit', async (req, res) => {
    const day = req.query.day as string | undefined
    const params: any[] = [req.params.tripId]
    let sql = `${TRANSIT_SELECT} WHERE ts.trip_id = $1`
    if (day != null) { params.push(Number(day)); sql += ` AND ts.day_number = $${params.length}` }
    sql += ' ORDER BY ts.created_at'
    const r = await pool.query(sql, params)
    res.json(r.rows.map(mapTransit))
  })

  app.post('/api/trips/:tripId/transit', async (req, res) => {
    const { dayNumber, afterEventId, mode, durationText, note } = req.body as {
      dayNumber: number; afterEventId: string | null; mode: string; durationText: string | null; note?: string | null
    }
    const segId = id()
    await pool.query(
      'INSERT INTO transit_segments (id, trip_id, day_number, after_event_id, mode, duration_text, note) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [segId, req.params.tripId, dayNumber, afterEventId, mode.trim(), durationText?.trim() || null, note?.trim() || null])
    const r = await pool.query(`${TRANSIT_SELECT} WHERE ts.id = $1`, [segId])
    res.json(mapTransit(r.rows[0]))
  })

  app.put('/api/transit/:id', async (req, res) => {
    const { mode, durationText, note, voucherId, afterEventId } = req.body as {
      mode?: string; durationText?: string | null; note?: string | null
      voucherId?: string | null; afterEventId?: string | null
    }
    const sets: string[] = []
    const params: any[] = []
    if (mode !== undefined) { params.push(mode.trim()); sets.push(`mode = $${params.length}`) }
    if (durationText !== undefined) { params.push(durationText?.trim() || null); sets.push(`duration_text = $${params.length}`) }
    if (note !== undefined) { params.push(note?.trim() || null); sets.push(`note = $${params.length}`) }
    if (voucherId !== undefined) { params.push(voucherId); sets.push(`voucher_id = $${params.length}`) }
    if (afterEventId !== undefined) { params.push(afterEventId); sets.push(`after_event_id = $${params.length}`) }
    if (sets.length === 0) { res.json({ ok: true }); return }
    params.push(req.params.id)
    await pool.query(`UPDATE transit_segments SET ${sets.join(', ')} WHERE id = $${params.length}`, params)
    res.json({ ok: true })
  })

  app.delete('/api/transit/:id', async (req, res) => {
    await pool.query('DELETE FROM transit_segments WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  })

  // ── 가계부 ────────────────────────────────────────────
  app.get('/api/trips/:tripId/expenses', async (req, res) => {
    const r = await pool.query(
      `SELECT e.*, m.name AS payer_name FROM expenses e
       JOIN members m ON m.id = e.paid_by
       WHERE e.trip_id = $1 ORDER BY e.spent_at DESC`, [req.params.tripId])
    const out = []
    for (const row of r.rows) {
      const splits = await pool.query('SELECT member_id FROM expense_splits WHERE expense_id = $1', [row.id])
      out.push({ ...mapExpense(row), splitWith: splits.rows.map((s) => s.member_id) })
    }
    res.json(out)
  })

  app.post('/api/trips/:tripId/expenses', async (req, res) => {
    const {
      eventId, amount, currency, category, description, paidBy, splitWith, spentAt,
      paymentMethod, memo, purchaseItems, isShared, isPrebooked,
    } = req.body as {
      eventId: string | null; amount: number; currency: string; category: string
      description: string; paidBy: string; splitWith: string[]; spentAt: string
      paymentMethod: string | null; memo: string | null; purchaseItems: string | null
      isShared: boolean; isPrebooked: boolean
    }
    const expenseId = id()
    await pool.query(
      `INSERT INTO expenses (
         id, trip_id, event_id, amount, currency, category, description, paid_by, spent_at,
         payment_method, memo, purchase_items, is_shared, is_prebooked
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [expenseId, req.params.tripId, eventId, amount, currency, category, description.trim(), paidBy, spentAt,
        paymentMethod ?? null, memo ?? null, purchaseItems ?? null, isShared ?? true, isPrebooked ?? false])
    for (const m of splitWith ?? []) {
      await pool.query('INSERT INTO expense_splits (expense_id, member_id) VALUES ($1,$2)', [expenseId, m])
    }
    res.json({ ok: true })
  })

  app.delete('/api/expenses/:id', async (req, res) => {
    await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  })

  // ── 여행별 고정 환율 ──────────────────────────────────
  app.get('/api/trips/:tripId/rates', async (req, res) => {
    const r = await pool.query('SELECT currency, krw_per_unit FROM trip_currency_rates WHERE trip_id = $1', [req.params.tripId])
    res.json(r.rows.map((row) => ({ currency: row.currency, krwPerUnit: Number(row.krw_per_unit) })))
  })

  app.put('/api/trips/:tripId/rates/:currency', async (req, res) => {
    const { krwPerUnit } = req.body as { krwPerUnit: number }
    await pool.query(
      `INSERT INTO trip_currency_rates (trip_id, currency, krw_per_unit) VALUES ($1,$2,$3)
       ON CONFLICT (trip_id, currency) DO UPDATE SET krw_per_unit = excluded.krw_per_unit`,
      [req.params.tripId, req.params.currency, krwPerUnit])
    res.json({ ok: true })
  })

  // ── 바우처 ────────────────────────────────────────────
  app.get('/api/trips/:tripId/vouchers', async (req, res) => {
    const r = await pool.query('SELECT * FROM vouchers WHERE trip_id = $1 ORDER BY created_at DESC', [req.params.tripId])
    res.json(r.rows.map(mapVoucher))
  })

  app.post('/api/trips/:tripId/vouchers', voucherUploader.array('files', 10), async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[]
    const added = []
    for (const f of files) {
      const voucherId = id()
      const rel = relativeFilePath('vouchers', f.filename)
      const fileType = path.extname(f.originalname).replace('.', '').toUpperCase() || 'FILE'
      await pool.query('INSERT INTO vouchers (id, trip_id, title, file_type, file_path) VALUES ($1,$2,$3,$4,$5)',
        [voucherId, req.params.tripId, f.originalname, fileType, rel])
      added.push({ id: voucherId, tripId: req.params.tripId, title: f.originalname, fileType, filePath: rel })
    }
    res.json(added)
  })

  app.delete('/api/vouchers/:id', async (req, res) => {
    const r = await pool.query('SELECT file_path FROM vouchers WHERE id = $1', [req.params.id])
    await pool.query('DELETE FROM vouchers WHERE id = $1', [req.params.id])
    if (r.rows[0]) safeUnlink(r.rows[0].file_path)
    res.json({ ok: true })
  })

  // ── 사진 ──────────────────────────────────────────────
  app.post('/api/events/:eventId/photos', photoUploader.array('files', 10), async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[]
    const added = []
    for (const f of files) {
      const photoId = id()
      const rel = relativeFilePath('photos', f.filename)
      await pool.query('INSERT INTO photos (id, event_id, file_path) VALUES ($1,$2,$3)', [photoId, req.params.eventId, rel])
      added.push({ id: photoId, eventId: req.params.eventId, filePath: rel })
    }
    res.json(added)
  })

  app.delete('/api/photos/:id', async (req, res) => {
    const r = await pool.query('SELECT file_path FROM photos WHERE id = $1', [req.params.id])
    await pool.query('DELETE FROM photos WHERE id = $1', [req.params.id])
    if (r.rows[0]) safeUnlink(r.rows[0].file_path)
    res.json({ ok: true })
  })

  // ── 보관함 ────────────────────────────────────────────
  app.get('/api/trips/:tripId/archive', async (req, res) => {
    const r = await pool.query('SELECT * FROM archive_items WHERE trip_id = $1 ORDER BY created_at DESC', [req.params.tripId])
    res.json(r.rows.map(mapArchive))
  })

  app.post('/api/trips/:tripId/archive/memo', async (req, res) => {
    const { title, body } = req.body as { title: string; body: string }
    const itemId = id()
    await pool.query('INSERT INTO archive_items (id, trip_id, kind, title, body) VALUES ($1,$2,$3,$4,$5)',
      [itemId, req.params.tripId, 'memo', title.trim() || '메모', body.trim()])
    const r = await pool.query('SELECT * FROM archive_items WHERE id = $1', [itemId])
    res.json(mapArchive(r.rows[0]))
  })

  app.post('/api/trips/:tripId/archive/link', async (req, res) => {
    const { title, url } = req.body as { title: string; url: string }
    const itemId = id()
    await pool.query('INSERT INTO archive_items (id, trip_id, kind, title, body) VALUES ($1,$2,$3,$4,$5)',
      [itemId, req.params.tripId, 'link', title.trim() || url.trim(), url.trim()])
    const r = await pool.query('SELECT * FROM archive_items WHERE id = $1', [itemId])
    res.json(mapArchive(r.rows[0]))
  })

  app.post('/api/trips/:tripId/archive/image', archiveUploader.array('files', 10), async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[]
    const added = []
    for (const f of files) {
      const itemId = id()
      const rel = relativeFilePath('archive', f.filename)
      await pool.query('INSERT INTO archive_items (id, trip_id, kind, title, file_path) VALUES ($1,$2,$3,$4,$5)',
        [itemId, req.params.tripId, 'image', f.originalname, rel])
      added.push({ id: itemId, tripId: req.params.tripId, kind: 'image', title: f.originalname, body: null, filePath: rel })
    }
    res.json(added)
  })

  app.delete('/api/archive/:id', async (req, res) => {
    const r = await pool.query('SELECT file_path FROM archive_items WHERE id = $1', [req.params.id])
    await pool.query('DELETE FROM archive_items WHERE id = $1', [req.params.id])
    if (r.rows[0]?.file_path) safeUnlink(r.rows[0].file_path)
    res.json({ ok: true })
  })

  app.post('/api/archive/:id/convert', async (req, res) => {
    const { tripId, dayNumber } = req.body as { tripId: string; dayNumber: number }
    const itemRow = await pool.query('SELECT * FROM archive_items WHERE id = $1', [req.params.id])
    const item = itemRow.rows[0]
    if (!item) { res.status(404).json({ error: '보관함 항목을 찾을 수 없어요.' }); return }

    const placeId = id()
    await pool.query('INSERT INTO places (id, name, address, category) VALUES ($1,$2,$3,$4)',
      [placeId, item.title, '', '기타'])

    const max = await pool.query(
      'SELECT COALESCE(MAX(sequence), 0) AS m FROM timeline_events WHERE trip_id = $1 AND day_number = $2',
      [tripId, dayNumber])
    const eventId = id()
    const review = item.kind === 'memo' ? item.body : null
    const linkUrl = item.kind === 'link' ? item.body : null
    await pool.query(
      'INSERT INTO timeline_events (id, trip_id, place_id, day_number, sequence, review, link_url) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [eventId, tripId, placeId, dayNumber, Number(max.rows[0].m) + 1, review, linkUrl])

    if (item.kind === 'image' && item.file_path) {
      await pool.query('INSERT INTO photos (id, event_id, file_path) VALUES ($1,$2,$3)', [id(), eventId, item.file_path])
    }
    await pool.query('DELETE FROM archive_items WHERE id = $1', [item.id])
    res.json({ ok: true })
  })

  // ── 일차 메모(그날의 기록·날씨) ───────────────────────
  app.get('/api/trips/:tripId/day-notes', async (req, res) => {
    const r = await pool.query('SELECT * FROM day_notes WHERE trip_id = $1', [req.params.tripId])
    res.json(r.rows.map((row) => ({
      tripId: row.trip_id, dayNumber: row.day_number, note: row.note, diary: row.diary,
      weatherEmoji: row.weather_emoji, weatherTemp: row.weather_temp != null ? Number(row.weather_temp) : null,
    })))
  })

  app.put('/api/trips/:tripId/day-notes/:dayNumber', async (req, res) => {
    const { note, diary, weatherEmoji, weatherTemp } = req.body as {
      note: string | null; diary: string | null; weatherEmoji: string | null; weatherTemp: number | null
    }
    await pool.query(
      `INSERT INTO day_notes (trip_id, day_number, note, diary, weather_emoji, weather_temp) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (trip_id, day_number) DO UPDATE SET
         note = excluded.note, diary = excluded.diary,
         weather_emoji = excluded.weather_emoji, weather_temp = excluded.weather_temp`,
      [req.params.tripId, Number(req.params.dayNumber), note, diary, weatherEmoji, weatherTemp])
    res.json({ ok: true })
  })

  // ── 체크리스트 (일차별 할일 / 준비물 / 쇼핑 / 음식) ──────
  app.get('/api/trips/:tripId/checklist', async (req, res) => {
    const scope = req.query.scope as string
    const day = req.query.day as string | undefined
    const params: any[] = [req.params.tripId, scope]
    let sql = 'SELECT * FROM checklist_items WHERE trip_id = $1 AND scope = $2'
    if (day != null) { params.push(Number(day)); sql += ` AND day_number = $${params.length}` }
    sql += ' ORDER BY sequence, created_at'
    const r = await pool.query(sql, params)
    res.json(r.rows.map(mapChecklist))
  })

  app.post('/api/trips/:tripId/checklist', async (req, res) => {
    const { scope, dayNumber, text } = req.body as { scope: string; dayNumber: number | null; text: string }
    const max = await pool.query(
      'SELECT COALESCE(MAX(sequence), 0) AS m FROM checklist_items WHERE trip_id = $1 AND scope = $2 AND day_number IS NOT DISTINCT FROM $3',
      [req.params.tripId, scope, dayNumber])
    const itemId = id()
    await pool.query(
      'INSERT INTO checklist_items (id, trip_id, scope, day_number, text, sequence) VALUES ($1,$2,$3,$4,$5,$6)',
      [itemId, req.params.tripId, scope, dayNumber, text.trim(), Number(max.rows[0].m) + 1])
    const r = await pool.query('SELECT * FROM checklist_items WHERE id = $1', [itemId])
    res.json(mapChecklist(r.rows[0]))
  })

  app.put('/api/checklist/:id', async (req, res) => {
    const { text, done } = req.body as { text?: string; done?: boolean }
    const sets: string[] = []
    const params: any[] = []
    if (text !== undefined) { params.push(text.trim()); sets.push(`text = $${params.length}`) }
    if (done !== undefined) { params.push(done); sets.push(`done = $${params.length}`) }
    if (sets.length === 0) { res.json({ ok: true }); return }
    params.push(req.params.id)
    await pool.query(`UPDATE checklist_items SET ${sets.join(', ')} WHERE id = $${params.length}`, params)
    res.json({ ok: true })
  })

  app.delete('/api/checklist/:id', async (req, res) => {
    await pool.query('DELETE FROM checklist_items WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  })

  // ── 버킷리스트 ────────────────────────────────────────
  const BUCKET_SELECT = `
    SELECT b.*, co.name AS country_name, ci.name AS city_name, t.title AS linked_trip_title
    FROM bucket_items b
    LEFT JOIN countries co ON co.id = b.country_id
    LEFT JOIN cities ci ON ci.id = b.city_id
    LEFT JOIN trips t ON t.id = b.linked_trip_id
  `

  app.get('/api/bucket', async (_req, res) => {
    const r = await pool.query(`${BUCKET_SELECT} ORDER BY b.done, b.created_at DESC`)
    res.json(r.rows.map(mapBucket))
  })

  app.post('/api/bucket', async (req, res) => {
    const { title, memo, countryId, cityId, category } = req.body as {
      title: string; memo: string | null; countryId: string | null; cityId: string | null; category: string | null
    }
    const itemId = id()
    await pool.query(
      'INSERT INTO bucket_items (id, title, memo, country_id, city_id, category) VALUES ($1,$2,$3,$4,$5,$6)',
      [itemId, title.trim(), memo, countryId, cityId, category])
    const r = await pool.query(`${BUCKET_SELECT} WHERE b.id = $1`, [itemId])
    res.json(mapBucket(r.rows[0]))
  })

  app.put('/api/bucket/:id', async (req, res) => {
    const { done, linkedTripId } = req.body as { done?: boolean; linkedTripId?: string | null }
    const sets: string[] = []
    const params: any[] = []
    if (done !== undefined) { params.push(done); sets.push(`done = $${params.length}`) }
    if (linkedTripId !== undefined) { params.push(linkedTripId); sets.push(`linked_trip_id = $${params.length}`) }
    if (sets.length === 0) { res.json({ ok: true }); return }
    params.push(req.params.id)
    await pool.query(`UPDATE bucket_items SET ${sets.join(', ')} WHERE id = $${params.length}`, params)
    res.json({ ok: true })
  })

  app.delete('/api/bucket/:id', async (req, res) => {
    await pool.query('DELETE FROM bucket_items WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  })

  // ── 설정 ──────────────────────────────────────────────
  app.get('/api/settings/:key', async (req, res) => {
    const r = await pool.query('SELECT value FROM settings WHERE key = $1', [req.params.key])
    res.json({ value: r.rows[0]?.value ?? null })
  })

  app.put('/api/settings/:key', async (req, res) => {
    const value = (req.body?.value ?? '') as string
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1,$2)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [req.params.key, value])
    res.json({ ok: true })
  })
}
