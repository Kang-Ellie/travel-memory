import crypto from 'node:crypto'
import path from 'node:path'
import type { Express as ExpressApp, Request, Response, NextFunction } from 'express'
import { pool, withTransaction, type Queryable } from './db.js'
import { makeUploader, uploadFile, safeUnlink, streamFile, decodeOriginalName, extractTakenDate } from './upload.js'
import { requireAuth, makeSessionToken, verifySessionToken, cookieOptions, SESSION_COOKIE } from './auth.js'

const id = (): string => crypto.randomUUID()

// 구글 API 하루 호출 상한. 콘솔 할당량과 별개로, 여기서 넘으면 구글에 요청 자체를 안 보낸다.
const DAILY_API_LIMITS: Record<'places' | 'geocode' | 'directions', number> = { places: 300, geocode: 300, directions: 300 }

// 이동수단 → 구글 Distance Matrix mode. 비행기/배/기타처럼 도로 경로가 의미 없는 수단은 매핑하지 않는다
// (그런 수단은 자동 계산 버튼 자체를 프론트에서 숨김).
const TRANSIT_MODE_TO_GOOGLE: Record<string, string> = {
  도보: 'walking', 지하철: 'transit', 버스: 'transit', 기차: 'transit', 택시: 'driving',
}

async function incrementDailyUsage(kind: keyof typeof DAILY_API_LIMITS): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const r = await pool.query(
    `INSERT INTO api_usage (usage_date, kind, count) VALUES ($1, $2, 1)
     ON CONFLICT (usage_date, kind) DO UPDATE SET count = api_usage.count + 1
     RETURNING count`,
    [today, kind],
  )
  return Number(r.rows[0].count)
}

async function overDailyLimit(kind: keyof typeof DAILY_API_LIMITS): Promise<boolean> {
  const count = await incrementDailyUsage(kind)
  return count > DAILY_API_LIMITS[kind]
}

// 최근 활동 로그 기록. 로그인이 공용 비밀번호 하나라 "누가"는 못 남기고 "무엇을·언제"만 남긴다.
async function logActivity(tripId: string | null, action: string, summary: string): Promise<void> {
  await pool.query(
    'INSERT INTO activity_log (id, trip_id, action, summary) VALUES ($1,$2,$3,$4)',
    [id(), tripId, action, summary],
  )
}

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

// 전부 메모리 저장소라 저장 목적지(subDir)와 무관하게 하나의 인스턴스를 공유해도 된다.
const uploader = makeUploader()

// ── 행 매핑 (snake_case DB → camelCase API) ──────────────
const mapTrip = (r: any) => ({
  id: r.id, title: r.title, startDate: r.start_date, endDate: r.end_date,
  budget: Number(r.budget), nights: r.nights != null ? Number(r.nights) : null, createdAt: r.created_at,
  cities: (r.cities ?? []) as Array<{ id: string; name: string; countryName: string; countryCode: string | null }>,
})
const mapMember = (r: any) => ({ id: r.id, name: r.name, emoji: r.emoji ?? null })
const mapPlace = (r: any) => ({
  id: r.id, name: r.name, address: r.address, category: r.category,
  lat: r.lat != null ? Number(r.lat) : null, lng: r.lng != null ? Number(r.lng) : null,
  memo: r.memo, mapUrl: r.map_url, rating: r.rating != null ? Number(r.rating) : null,
  pros: r.pros, cons: r.cons, countryId: r.country_id, cityId: r.city_id,
  countryName: r.country_name ?? null, countryCode: r.country_code ?? null, cityName: r.city_name ?? null,
  hours: r.hours, reservationNeeded: !!r.reservation_needed, recommendedMenu: r.recommended_menu,
  breakTime: r.break_time, coverPhoto: r.cover_photo_path ?? null, createdAt: r.created_at,
  valetCompany: r.valet_company, bookingChannel: r.booking_channel,
  grade: r.grade, stayType: r.stay_type, airportCode: r.airport_code, directions: r.directions, babyMenu: r.baby_menu,
  recommend: r.recommend == null ? null : !!r.recommend, tip: r.tip,
  visitCount: r.visit_count != null ? Number(r.visit_count) : 0,
})
const mapTransit = (r: any) => ({
  id: r.id, tripId: r.trip_id, dayNumber: r.day_number, afterEventId: r.after_event_id,
  mode: r.mode, durationText: r.duration_text, note: r.note, voucherId: r.voucher_id,
  voucherTitle: r.voucher_title ?? null, createdAt: r.created_at,
})
const mapFlightDetail = (r: any) => ({
  departAt: r.depart_at, arriveAt: r.arrive_at,
  durationMinutes: r.duration_minutes != null ? Number(r.duration_minutes) : null,
  bookingRef: r.booking_ref, bookedVia: r.booked_via, departureLocation: r.departure_location,
  confirmed: !!r.confirmed, voucherId: r.voucher_id, voucherTitle: r.voucher_title ?? null,
  airline: r.airline, airlineLogoPath: r.airline_logo_path ?? null, flightNo: r.flight_no,
  destination: r.destination, gate: r.gate, seat: r.seat, passengerIds: r.passenger_ids ?? [],
  destinationPlaceId: r.destination_place_id ?? null,
  destinationPlaceName: r.destination_place_name ?? null,
  destinationAirportCode: r.destination_airport_code ?? null,
})
const FLIGHT_SELECT = `
  SELECT fd.*, v.title AS voucher_title, dp.name AS destination_place_name, dp.airport_code AS destination_airport_code
  FROM flight_details fd
  LEFT JOIN vouchers v ON v.id = fd.voucher_id
  LEFT JOIN places dp ON dp.id = fd.destination_place_id
`
const mapValetDetail = (r: any) => ({
  scheduledAt: r.scheduled_at, location: r.location, company: r.company,
  bookedVia: r.booked_via, bookingRef: r.booking_ref, confirmed: !!r.confirmed,
  voucherId: r.voucher_id, voucherTitle: r.voucher_title ?? null, note: r.note,
})
const VALET_SELECT = `
  SELECT vd.*, v.title AS voucher_title FROM valet_details vd
  LEFT JOIN vouchers v ON v.id = vd.voucher_id
`
const mapLodgingDetail = (r: any) => ({
  checkInAt: r.check_in_at, checkOutAt: r.check_out_at,
  bookingRef: r.booking_ref, bookedVia: r.booked_via, confirmed: !!r.confirmed,
  voucherId: r.voucher_id, voucherTitle: r.voucher_title ?? null, note: r.note,
  breakfastIncluded: !!r.breakfast_included, roomType: r.room_type,
})
const LODGING_SELECT = `
  SELECT ld.*, v.title AS voucher_title FROM lodging_details ld
  LEFT JOIN vouchers v ON v.id = ld.voucher_id
`
const mapReservationDetail = (r: any) => ({
  reservedAt: r.reserved_at, partySize: r.party_size != null ? Number(r.party_size) : null,
  bookingRef: r.booking_ref, bookedVia: r.booked_via, confirmed: !!r.confirmed,
  voucherId: r.voucher_id, voucherTitle: r.voucher_title ?? null, note: r.note,
})
const RESERVATION_SELECT = `
  SELECT rd.*, v.title AS voucher_title FROM reservation_details rd
  LEFT JOIN vouchers v ON v.id = rd.voucher_id
`
// 이벤트 행 목록에 장소·사진·티켓(항공/발렛/숙소/예약) 상세를 붙인다.
// 이벤트마다 6쿼리를 날리던 N+1 패턴 대신, 이벤트 수와 무관하게 6쿼리 고정(배치 조회).
async function attachEventDetails(eventRows: any[]) {
  if (eventRows.length === 0) return []
  const eventIds = eventRows.map((e) => e.id)
  const placeIds = [...new Set(eventRows.map((e) => e.place_id))]
  const [places, photos, flights, valets, lodgings, reservations] = await Promise.all([
    pool.query('SELECT * FROM places WHERE id = ANY($1)', [placeIds]),
    pool.query('SELECT * FROM photos WHERE event_id = ANY($1) ORDER BY created_at', [eventIds]),
    pool.query(`${FLIGHT_SELECT} WHERE fd.event_id = ANY($1)`, [eventIds]),
    pool.query(`${VALET_SELECT} WHERE vd.event_id = ANY($1)`, [eventIds]),
    pool.query(`${LODGING_SELECT} WHERE ld.event_id = ANY($1)`, [eventIds]),
    pool.query(`${RESERVATION_SELECT} WHERE rd.event_id = ANY($1)`, [eventIds]),
  ])
  const placeById = new Map(places.rows.map((p: any) => [p.id, p]))
  const photosByEvent = new Map<string, any[]>()
  for (const ph of photos.rows) {
    const list = photosByEvent.get(ph.event_id) ?? []
    list.push(ph)
    photosByEvent.set(ph.event_id, list)
  }
  const byEventId = (rows: any[]) => new Map(rows.map((r: any) => [r.event_id, r]))
  const flightBy = byEventId(flights.rows)
  const valetBy = byEventId(valets.rows)
  const lodgingBy = byEventId(lodgings.rows)
  const reservationBy = byEventId(reservations.rows)
  return eventRows.map((ev) => ({
    ...mapEvent(ev),
    place: mapPlace(placeById.get(ev.place_id)),
    photos: (photosByEvent.get(ev.id) ?? []).map(mapPhoto),
    flight: flightBy.has(ev.id) ? mapFlightDetail(flightBy.get(ev.id)) : null,
    valet: valetBy.has(ev.id) ? mapValetDetail(valetBy.get(ev.id)) : null,
    lodging: lodgingBy.has(ev.id) ? mapLodgingDetail(lodgingBy.get(ev.id)) : null,
    reservation: reservationBy.has(ev.id) ? mapReservationDetail(reservationBy.get(ev.id)) : null,
  }))
}

const mapEvent = (r: any) => ({
  id: r.id, tripId: r.trip_id, placeId: r.place_id, dayNumber: r.day_number, sequence: r.sequence,
  plannedTime: r.planned_time, rating: r.rating != null ? Number(r.rating) : null,
  review: r.review, mustTry: r.must_try, memo: r.memo, linkUrl: r.link_url, createdAt: r.created_at,
  bucketItemId: r.bucket_item_id, bucketItemTitle: r.bucket_item_title ?? null,
})
const mapExpense = (r: any) => ({
  id: r.id, tripId: r.trip_id, eventId: r.event_id, amount: Number(r.amount), currency: r.currency,
  category: r.category, description: r.description, paidBy: r.paid_by, payerName: r.payer_name,
  spentAt: r.spent_at, paymentMethod: r.payment_method, memo: r.memo, purchaseItems: r.purchase_items,
  isShared: r.is_shared, isPrebooked: r.is_prebooked,
})
const mapVoucher = (r: any) => ({
  id: r.id, tripId: r.trip_id, title: r.title, fileType: r.file_type, filePath: r.file_path,
  category: r.category, createdAt: r.created_at,
})
const mapPhoto = (r: any) => ({ id: r.id, eventId: r.event_id, filePath: r.file_path })
const mapArchive = (r: any) => ({
  id: r.id, tripId: r.trip_id, kind: r.kind, title: r.title, body: r.body, filePath: r.file_path,
  linkedPlaceId: r.linked_place_id, linkedPlaceName: r.linked_place_name ?? null, createdAt: r.created_at,
})
const mapCountry = (r: any) => ({
  id: r.id, name: r.name, code: r.code, capital: r.capital, phoneCode: r.phone_code,
  currency: r.currency, voltage: r.voltage, language: r.language, visa: r.visa,
  prepDocs: r.prep_docs, prepDocsUrl: r.prep_docs_url,
  emergencyPolice: r.emergency_police, emergencyMedical: r.emergency_medical,
  weather: r.weather, tip: r.tip, priceLevel: r.price_level, exchangeRate: r.exchange_rate,
  createdAt: r.created_at,
})
const mapCity = (r: any) => ({
  id: r.id, countryId: r.country_id, name: r.name, flightDuration: r.flight_duration,
  timeDiff: r.time_diff, flightAirport: r.flight_airport, flightType: r.flight_type,
  bestSeason: r.best_season, caution: r.caution,
  createdAt: r.created_at, visited: !!r.visited,
})
const mapChecklist = (r: any) => ({
  id: r.id, tripId: r.trip_id, scope: r.scope, dayNumber: r.day_number, text: r.text,
  category: r.category, done: r.done, sequence: r.sequence, createdAt: r.created_at,
})

const PREDEPARTURE_PRESETS = ['항공권 예약', '숙소 예약', '여행자보험 가입', '발렛 예약', '로밍 / eSIM', '환전']
const PACKING_PRESETS: Record<string, string[]> = {
  필수: [
    '멀티 어댑터 & 돼지코', '물티슈 & 휴지', '상비약', '상의', '선글라스', '세면도구', '속옷', '스킨케어',
    '양말', '여권', '외투 & 가디건', '하의', '해외 결제 가능한 신용카드', '항공권 전자티켓',
  ],
  선택: [
    '국제 운전 면허증', '노트북', '마스크', '모자', '삼각대 & 셀카봉', '수영복', '우산 & 비옷',
    '운동화 & 구두 & 샌들 & 슬리퍼', '지퍼백 & 비닐봉지 & 여행용 파우치', '태블릿',
  ],
  당일준비물: ['보조배터리', '선크림', '충전기'],
}

async function seedChecklistPresets(tripId: string, scope: 'predeparture' | 'packing', db: Queryable = pool): Promise<void> {
  const existing = await db.query('SELECT text, category FROM checklist_items WHERE trip_id = $1 AND scope = $2', [tripId, scope])
  const seen = new Set(existing.rows.map((r: any) => `${r.category ?? ''}::${r.text}`))
  const toInsert: Array<{ text: string; category: string | null }> = scope === 'predeparture'
    ? PREDEPARTURE_PRESETS.map((text) => ({ text, category: null }))
    : Object.entries(PACKING_PRESETS).flatMap(([category, texts]) => texts.map((text) => ({ text, category })))
  let seq = existing.rows.length
  const rows: Array<[string, string, string, string, string | null, number]> = []
  for (const item of toInsert) {
    const key = `${item.category ?? ''}::${item.text}`
    if (seen.has(key)) continue
    seq += 1
    rows.push([id(), tripId, scope, item.text, item.category, seq])
  }
  if (rows.length === 0) return
  const values = rows.map((_, i) => `($${i * 6 + 1},$${i * 6 + 2},$${i * 6 + 3},$${i * 6 + 4},$${i * 6 + 5},$${i * 6 + 6})`).join(', ')
  await db.query(
    `INSERT INTO checklist_items (id, trip_id, scope, text, category, sequence) VALUES ${values}`,
    rows.flat())
}
const mapBucket = (r: any) => ({
  id: r.id, title: r.title, memo: r.memo, tip: r.tip ?? null,
  countryIds: r.country_ids ?? [], cityIds: r.city_ids ?? [],
  category: r.category, done: r.done, linkedTripId: r.linked_trip_id,
  linkedTripTitle: r.linked_trip_title ?? null, linkedPlaceId: r.linked_place_id,
  linkedPlaceName: r.linked_place_name ?? null, imagePath: r.image_path ?? null, createdAt: r.created_at,
})

const TRIP_CITIES_SUBQUERY = `
  COALESCE((
    SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'countryName', co.name, 'countryCode', co.code) ORDER BY tc.sequence)
    FROM trip_cities tc JOIN cities c ON c.id = tc.city_id JOIN countries co ON co.id = c.country_id
    WHERE tc.trip_id = t.id
  ), '[]'::json) AS cities
`

async function setTripCities(tripId: string, cityIds: string[], db: Queryable = pool): Promise<void> {
  await db.query('DELETE FROM trip_cities WHERE trip_id = $1', [tripId])
  const ids = cityIds ?? []
  if (ids.length === 0) return
  const values = ids.map((_, i) => `($1, $${i + 2}, ${i})`).join(', ')
  await db.query(`INSERT INTO trip_cities (trip_id, city_id, sequence) VALUES ${values}`, [tripId, ...ids])
}

async function setTripMembers(tripId: string, memberIds: string[], db: Queryable = pool): Promise<void> {
  const ids = memberIds ?? []
  if (ids.length === 0) return
  const values = ids.map((_, i) => `($1, $${i + 2})`).join(', ')
  await db.query(`INSERT INTO trip_members (trip_id, member_id) VALUES ${values}`, [tripId, ...ids])
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
  app.get('/api/files/*', async (req: Request, res: Response) => {
    const rel = (req.params as any)[0] as string
    await streamFile(rel, res)
  })

  // ── 여행 ──────────────────────────────────────────────
  app.get('/api/trips', async (_req, res) => {
    const r = await pool.query(`SELECT t.*, ${TRIP_CITIES_SUBQUERY} FROM trips t ORDER BY t.start_date DESC`)
    res.json(r.rows.map(mapTrip))
  })

  app.post('/api/trips', async (req, res) => {
    const { title, startDate, endDate, budget, nights, memberIds, cityIds } = req.body as {
      title: string; startDate: string; endDate: string; budget: number; nights?: number | null; memberIds: string[]; cityIds: string[]
    }
    const tripId = id()
    // 여행 하나 만드는 데 테이블 4개(trips/trip_members/trip_cities/checklist_items)가 얽힌다.
    // 트랜잭션으로 묶어야 중간에 실패해도 '멤버 없는 반쪽 여행' 같은 게 안 남는다.
    await withTransaction(async (db) => {
      await db.query('INSERT INTO trips (id, title, start_date, end_date, budget, nights) VALUES ($1,$2,$3,$4,$5,$6)',
        [tripId, title, startDate, endDate, budget ?? 0, nights ?? null])
      await setTripMembers(tripId, memberIds, db)
      await setTripCities(tripId, cityIds, db)
      await seedChecklistPresets(tripId, 'predeparture', db)
      await seedChecklistPresets(tripId, 'packing', db)
    })
    await logActivity(tripId, 'trip_created', title)
    const r = await pool.query(`SELECT t.*, ${TRIP_CITIES_SUBQUERY} FROM trips t WHERE t.id = $1`, [tripId])
    res.json(mapTrip(r.rows[0]))
  })

  app.put('/api/trips/:id', async (req, res) => {
    const { title, startDate, endDate, budget, nights, cityIds } = req.body as {
      title: string; startDate: string; endDate: string; budget: number; nights?: number | null; cityIds: string[]
    }
    // trips UPDATE + 도시 재설정 + 기간축소 유령일정 처리가 한 번에 부분 적용되면 안 되므로 트랜잭션으로 묶는다.
    const unassignedCount = await withTransaction(async (db) => {
      await db.query('UPDATE trips SET title=$1, start_date=$2, end_date=$3, budget=$4, nights=$5 WHERE id=$6',
        [title, startDate, endDate, budget ?? 0, nights ?? null, req.params.id])
      await setTripCities(req.params.id, cityIds, db)

      // 여행 기간을 줄이면 범위 밖 일차의 일정이 DB에 남는데, 일정 화면은 1~N일차 탭만
      // 그리므로 접근 불가능한 유령 데이터가 된다. 지우는 대신 '미배정 티켓'(day_number NULL)으로
      // 옮겨서 리뷰·사진·지출 연결을 보존하고, 유저가 다시 일차를 배정할 수 있게 한다.
      // 그 일차들의 이동 구간은 앞뒤 일정이 사라져 의미가 없으므로 삭제한다.
      const s = new Date(`${startDate}T00:00:00`)
      const e = new Date(`${endDate}T00:00:00`)
      const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1)
      await db.query('DELETE FROM transit_segments WHERE trip_id = $1 AND day_number > $2', [req.params.id, days])
      const moved = await db.query(
        'UPDATE timeline_events SET day_number = NULL, sequence = 0 WHERE trip_id = $1 AND day_number > $2 RETURNING id',
        [req.params.id, days])
      return moved.rows.length
    })
    res.json({ ok: true, unassignedCount })
  })

  // 여행 삭제 시 CASCADE로 함께 지워지는 행(사진·일기 사진·바우처·보관함 이미지·항공사 로고)이
  // 가리키던 R2 파일을 먼저 모아뒀다가, DB 삭제가 성공한 뒤 지운다. DB만 지우면 R2에
  // 아무도 참조하지 않는 유령 파일이 영구히 쌓인다 (개별 삭제 라우트는 safeUnlink를
  // 호출하지만 CASCADE 삭제는 코드에서 감지할 수 없으므로 여기서 직접 처리).
  async function collectTripFilePaths(tripId: string): Promise<string[]> {
    const [photos, dayPhotos, vouchers, archives, logos] = await Promise.all([
      pool.query(
        `SELECT ph.file_path FROM photos ph
         JOIN timeline_events te ON te.id = ph.event_id WHERE te.trip_id = $1`, [tripId]),
      pool.query('SELECT file_path FROM day_note_photos WHERE trip_id = $1', [tripId]),
      pool.query('SELECT file_path FROM vouchers WHERE trip_id = $1', [tripId]),
      pool.query('SELECT file_path FROM archive_items WHERE trip_id = $1 AND file_path IS NOT NULL', [tripId]),
      pool.query(
        `SELECT fd.airline_logo_path AS file_path FROM flight_details fd
         JOIN timeline_events te ON te.id = fd.event_id
         WHERE te.trip_id = $1 AND fd.airline_logo_path IS NOT NULL`, [tripId]),
    ])
    return [...photos.rows, ...dayPhotos.rows, ...vouchers.rows, ...archives.rows, ...logos.rows]
      .map((r) => r.file_path as string)
  }

  app.delete('/api/trips/:id', async (req, res) => {
    const filePaths = await collectTripFilePaths(req.params.id)
    await pool.query('DELETE FROM trips WHERE id = $1', [req.params.id])
    await Promise.all(filePaths.map((p) => safeUnlink(p)))
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
      await logActivity(null, 'member_added', name)
      res.json({ id: memberId, name, emoji: null })
    } catch {
      res.json({ error: '이미 같은 이름의 동행인이 있어요.' })
    }
  })

  app.put('/api/members/:id', async (req, res) => {
    const emoji = (req.body?.emoji ?? null) as string | null
    await pool.query('UPDATE members SET emoji = $1 WHERE id = $2', [emoji, req.params.id])
    res.json({ ok: true })
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
    await withTransaction(async (db) => {
      await db.query('DELETE FROM trip_members WHERE trip_id = $1', [req.params.tripId])
      await setTripMembers(req.params.tripId, memberIds, db)
    })
    res.json({ ok: true })
  })

  // ── 장소 족보 ─────────────────────────────────────────
  const PLACE_SELECT = `
    SELECT p.*, co.name AS country_name, co.code AS country_code, ci.name AS city_name,
      (
        SELECT ph.file_path FROM photos ph
        JOIN timeline_events te ON te.id = ph.event_id
        WHERE te.place_id = p.id
        ORDER BY ph.id LIMIT 1
      ) AS cover_photo_path,
      (SELECT COUNT(*) FROM timeline_events te2 WHERE te2.place_id = p.id) AS visit_count
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
      hours, reservationNeeded, recommendedMenu, breakTime,
      valetCompany, bookingChannel, grade, stayType, airportCode, directions, babyMenu, recommend, tip,
    } = req.body as {
      name: string; address: string; category: string; lat?: number | null; lng?: number | null
      memo?: string | null; mapUrl?: string | null; rating?: number | null
      pros?: string | null; cons?: string | null; countryId?: string | null; cityId?: string | null
      hours?: string | null; reservationNeeded?: boolean; recommendedMenu?: string | null; breakTime?: string | null
      valetCompany?: string | null; bookingChannel?: string | null
      grade?: string | null; stayType?: string | null; airportCode?: string | null; directions?: string | null; babyMenu?: string | null
      recommend?: boolean | null; tip?: string | null
    }
    const placeId = id()
    await pool.query(
      `INSERT INTO places (id, name, address, category, lat, lng, memo, map_url, rating, pros, cons, country_id, city_id,
         hours, reservation_needed, recommended_menu, break_time,
         valet_company, booking_channel, grade, stay_type, directions, baby_menu, recommend, tip, airport_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
      [placeId, name.trim(), (address ?? '').trim(), category, lat ?? null, lng ?? null, memo ?? null,
        mapUrl?.trim() || null, rating ?? null, pros?.trim() || null, cons?.trim() || null,
        countryId || null, cityId || null, hours?.trim() || null, reservationNeeded ?? false, recommendedMenu?.trim() || null,
        breakTime?.trim() || null,
        valetCompany?.trim() || null, bookingChannel?.trim() || null, grade?.trim() || null, stayType?.trim() || null,
        directions?.trim() || null, babyMenu?.trim() || null, recommend ?? null, tip?.trim() || null,
        airportCode?.trim().toUpperCase() || null])
    await logActivity(null, 'place_added', name.trim())
    const r = await pool.query(`${PLACE_SELECT} WHERE p.id = $1`, [placeId])
    res.json(mapPlace(r.rows[0]))
  })

  app.put('/api/places/:id', async (req, res) => {
    const {
      name, address, category, memo, mapUrl, rating, pros, cons, countryId, cityId,
      hours, reservationNeeded, recommendedMenu, breakTime,
      valetCompany, bookingChannel, grade, stayType, airportCode, directions, babyMenu, recommend, tip,
    } = req.body as {
      name: string; address: string; category: string; memo: string | null; mapUrl: string | null
      rating: number | null; pros: string | null; cons: string | null
      countryId: string | null; cityId: string | null
      hours: string | null; reservationNeeded: boolean; recommendedMenu: string | null; breakTime: string | null
      valetCompany?: string | null; bookingChannel?: string | null
      grade?: string | null; stayType?: string | null; airportCode?: string | null; directions?: string | null; babyMenu?: string | null
      recommend?: boolean | null; tip?: string | null
    }
    await pool.query(
      `UPDATE places SET name=$1, address=$2, category=$3, memo=$4, map_url=$5, rating=$6, pros=$7, cons=$8,
         country_id=$9, city_id=$10, hours=$11, reservation_needed=$12, recommended_menu=$13, break_time=$14,
         valet_company=$15, booking_channel=$16, grade=$17, directions=$18, baby_menu=$19, recommend=$20, tip=$21,
         stay_type=$22, airport_code=$23 WHERE id=$24`,
      [name.trim(), (address ?? '').trim(), category, memo, mapUrl?.trim() || null, rating ?? null,
        pros?.trim() || null, cons?.trim() || null, countryId || null, cityId || null,
        hours?.trim() || null, reservationNeeded ?? false, recommendedMenu?.trim() || null, breakTime?.trim() || null,
        valetCompany?.trim() || null, bookingChannel?.trim() || null, grade?.trim() || null,
        directions?.trim() || null, babyMenu?.trim() || null, recommend ?? null, tip?.trim() || null,
        stayType?.trim() || null, airportCode?.trim().toUpperCase() || null, req.params.id])
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

    const detailed = await attachEventDetails(events.rows)
    const visits = detailed.map((d, i) => ({ ...d, tripTitle: events.rows[i].trip_title }))

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
    if (await overDailyLimit('places')) {
      res.json({ error: '오늘 장소 검색 호출 한도를 넘었어요. 내일 다시 시도해주세요.' })
      return
    }
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

  // 구글 지도 링크(단축링크 포함)에서 이름·주소를 최대한 뽑아내본다.
  // 단축 링크는 리다이렉트를 따라가 실제 URL의 좌표/이름 패턴을 파싱하고,
  // API 키가 등록돼 있으면 좌표를 역지오코딩해서 정식 주소까지 가져온다. 100% 보장은 아님.
  app.get('/api/places/resolve-map-link', async (req, res) => {
    const url = ((req.query.url ?? '') as string).trim()
    if (!url) { res.json({ error: '링크를 입력해주세요.' }); return }
    try {
      const resolved = await fetch(url, { redirect: 'follow' })
      const finalUrl = resolved.url

      const atMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
      const bangMatch = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
      const qMatch = finalUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
      const coords = bangMatch || atMatch || qMatch
      const lat = coords ? Number(coords[1]) : null
      const lng = coords ? Number(coords[2]) : null

      const placeMatch = finalUrl.match(/\/place\/([^/@]+)/)
      const name = placeMatch ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')) : null

      let address: string | null = null
      if (lat != null && lng != null) {
        const keyRow = await pool.query("SELECT value FROM settings WHERE key = 'googleApiKey'")
        const key = keyRow.rows[0]?.value?.trim()
        if (key && !(await overDailyLimit('geocode'))) {
          const gr = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}&language=ko`)
          if (gr.ok) {
            const json = (await gr.json()) as { results?: Array<{ formatted_address?: string }> }
            address = json.results?.[0]?.formatted_address ?? null
          }
        }
      }

      if (!address && !name) {
        res.json({ error: '이 링크에서 주소를 찾지 못했어요. 직접 입력해주세요.' })
        return
      }
      res.json({ name, address, lat, lng })
    } catch (err) {
      res.json({ error: `링크 확인 실패 (서버 인터넷 연결을 확인해주세요): ${String(err)}` })
    }
  })

  // 두 장소 사이 이동시간을 구글 Distance Matrix로 자동 계산 — 이동 구간을 저장/수정할 때
  // 한 번만 호출해서 durationText에 채워두는 용도(타임라인을 열 때마다 호출하지 않음, 무료 티어 방어).
  app.get('/api/directions/duration', async (req, res) => {
    const { originPlaceId, destPlaceId, mode } = req.query as { originPlaceId?: string; destPlaceId?: string; mode?: string }
    const googleMode = mode ? TRANSIT_MODE_TO_GOOGLE[mode] : undefined
    if (!originPlaceId || !destPlaceId || !googleMode) { res.json({ error: '이 교통수단은 자동 계산을 지원하지 않아요.' }); return }

    const keyRow = await pool.query("SELECT value FROM settings WHERE key = 'googleApiKey'")
    const key = keyRow.rows[0]?.value?.trim()
    if (!key) { res.json({ error: '[⚙️ 설정]에서 구글 API 키를 먼저 등록해주세요.' }); return }
    if (await overDailyLimit('directions')) { res.json({ error: '오늘 자동 계산 요청 한도를 넘었어요. 내일 다시 시도해주세요.' }); return }

    const places = await pool.query('SELECT id, lat, lng, address FROM places WHERE id = ANY($1)', [[originPlaceId, destPlaceId]])
    const origin = places.rows.find((p) => p.id === originPlaceId)
    const dest = places.rows.find((p) => p.id === destPlaceId)
    if (!origin || !dest) { res.json({ error: '장소를 찾을 수 없어요.' }); return }

    const originParam = origin.lat != null && origin.lng != null ? `${origin.lat},${origin.lng}` : origin.address
    const destParam = dest.lat != null && dest.lng != null ? `${dest.lat},${dest.lng}` : dest.address
    if (!originParam || !destParam) { res.json({ error: '두 장소 모두 좌표나 주소가 있어야 계산할 수 있어요.' }); return }

    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originParam)}` +
        `&destinations=${encodeURIComponent(destParam)}&mode=${googleMode}&language=ko&key=${key}`
      const r = await fetch(url)
      const json = (await r.json()) as {
        rows?: Array<{ elements?: Array<{ status: string; duration?: { text: string } }> }>
      }
      const element = json.rows?.[0]?.elements?.[0]
      if (!element || element.status !== 'OK' || !element.duration) {
        res.json({ error: '경로를 찾지 못했어요. 직접 입력해주세요.' })
        return
      }
      res.json({ durationText: element.duration.text })
    } catch (err) {
      res.json({ error: `계산 실패 (서버 인터넷 연결을 확인해주세요): ${String(err)}` })
    }
  })

  // ── 국가·도시 족보 ────────────────────────────────────
  app.get('/api/countries', async (_req, res) => {
    const r = await pool.query('SELECT * FROM countries ORDER BY name')
    res.json(r.rows.map(mapCountry))
  })

  app.post('/api/countries', async (req, res) => {
    const {
      name, code, capital, phoneCode, currency, voltage, language, visa, prepDocs, prepDocsUrl,
      emergencyPolice, emergencyMedical, weather, tip, priceLevel, exchangeRate,
    } = req.body as {
      name: string; code: string | null; capital: string | null; phoneCode: string | null; currency: string | null
      voltage: string | null; language: string | null; visa: string | null; prepDocs: string | null
      prepDocsUrl: string | null; emergencyPolice: string | null; emergencyMedical: string | null
      weather: string | null; tip: string | null; priceLevel: string | null; exchangeRate: string | null
    }
    const countryId = id()
    await pool.query(
      `INSERT INTO countries (id, name, code, capital, phone_code, currency, voltage, language, visa, prep_docs,
         prep_docs_url, emergency_police, emergency_medical, weather, tip, price_level, exchange_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [countryId, name.trim(), code, capital, phoneCode, currency, voltage, language, visa, prepDocs,
        prepDocsUrl, emergencyPolice, emergencyMedical, weather, tip, priceLevel, exchangeRate])
    const r = await pool.query('SELECT * FROM countries WHERE id = $1', [countryId])
    res.json(mapCountry(r.rows[0]))
  })

  app.put('/api/countries/:id', async (req, res) => {
    const {
      name, code, capital, phoneCode, currency, voltage, language, visa, prepDocs, prepDocsUrl,
      emergencyPolice, emergencyMedical, weather, tip, priceLevel, exchangeRate,
    } = req.body as {
      name: string; code: string | null; capital: string | null; phoneCode: string | null; currency: string | null
      voltage: string | null; language: string | null; visa: string | null; prepDocs: string | null
      prepDocsUrl: string | null; emergencyPolice: string | null; emergencyMedical: string | null
      weather: string | null; tip: string | null; priceLevel: string | null; exchangeRate: string | null
    }
    await pool.query(
      `UPDATE countries SET name=$1, code=$2, capital=$3, phone_code=$4, currency=$5, voltage=$6, language=$7,
         visa=$8, prep_docs=$9, prep_docs_url=$10, emergency_police=$11, emergency_medical=$12,
         weather=$13, tip=$14, price_level=$15, exchange_rate=$16 WHERE id=$17`,
      [name.trim(), code, capital, phoneCode, currency, voltage, language, visa, prepDocs, prepDocsUrl,
        emergencyPolice, emergencyMedical, weather, tip, priceLevel, exchangeRate, req.params.id])
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
    const { countryId, name, flightDuration, timeDiff, flightAirport, flightType, bestSeason, caution } = req.body as {
      countryId: string; name: string; flightDuration: string | null; timeDiff: string | null
      flightAirport?: string | null; flightType?: string | null
      bestSeason?: string | null; caution?: string | null
    }
    const cityId = id()
    await pool.query(
      `INSERT INTO cities (id, country_id, name, flight_duration, time_diff, flight_airport, flight_type, best_season, caution)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cityId, countryId, name.trim(), flightDuration, timeDiff, flightAirport ?? null, flightType ?? null,
        bestSeason?.trim() || null, caution?.trim() || null])
    const r = await pool.query(`${CITY_SELECT} WHERE c.id = $1`, [cityId])
    res.json(mapCity(r.rows[0]))
  })

  app.put('/api/cities/:id', async (req, res) => {
    const { name, flightDuration, timeDiff, flightAirport, flightType, bestSeason, caution } = req.body as {
      name: string; flightDuration: string | null; timeDiff: string | null
      flightAirport?: string | null; flightType?: string | null
      bestSeason?: string | null; caution?: string | null
    }
    await pool.query(
      `UPDATE cities SET name=$1, flight_duration=$2, time_diff=$3, flight_airport=$4, flight_type=$5,
         best_season=$6, caution=$7 WHERE id=$8`,
      [name.trim(), flightDuration, timeDiff, flightAirport ?? null, flightType ?? null,
        bestSeason?.trim() || null, caution?.trim() || null, req.params.id])
    res.json({ ok: true })
  })

  app.delete('/api/cities/:id', async (req, res) => {
    await pool.query('DELETE FROM cities WHERE id = $1', [req.params.id])
    res.json({})
  })

  // 도시 허브 — 이 도시에 저장된 장소를 방문횟수·평점과 함께. "가봤어요"(visitCount>0) /
  // "위시"(=0) 구분과 카테고리별 TOP3는 프론트에서 이 목록을 정렬해서 만든다.
  app.get('/api/cities/:id/places', async (req, res) => {
    const r = await pool.query(
      `SELECT p.*, co.name AS country_name, co.code AS country_code, ci.name AS city_name,
        (
          SELECT ph.file_path FROM photos ph
          JOIN timeline_events te ON te.id = ph.event_id
          WHERE te.place_id = p.id ORDER BY ph.id LIMIT 1
        ) AS cover_photo_path,
        (SELECT COUNT(*) FROM timeline_events te2 WHERE te2.place_id = p.id) AS visit_count,
        (SELECT AVG(te3.rating) FROM timeline_events te3 WHERE te3.place_id = p.id AND te3.rating IS NOT NULL) AS avg_visit_rating
      FROM places p
      LEFT JOIN countries co ON co.id = p.country_id
      LEFT JOIN cities ci ON ci.id = p.city_id
      WHERE p.city_id = $1
      ORDER BY p.name`,
      [req.params.id])

    const totalsR = await pool.query(
      `SELECT te.place_id, e.currency, SUM(e.amount) AS total
       FROM expenses e JOIN timeline_events te ON te.id = e.event_id
       WHERE te.place_id IN (SELECT id FROM places WHERE city_id = $1)
       GROUP BY te.place_id, e.currency`,
      [req.params.id])
    const totalsByPlace = new Map<string, Array<{ currency: string; total: number }>>()
    for (const row of totalsR.rows) {
      const list = totalsByPlace.get(row.place_id) ?? []
      list.push({ currency: row.currency, total: Number(row.total) })
      totalsByPlace.set(row.place_id, list)
    }

    res.json(r.rows.map((row) => ({
      place: mapPlace(row),
      visitCount: Number(row.visit_count),
      avgVisitRating: row.avg_visit_rating != null ? Number(row.avg_visit_rating) : null,
      spentTotals: totalsByPlace.get(row.id) ?? [],
    })))
  })

  // ── 동선(타임라인) ────────────────────────────────────
  async function loadEvents(tripId: string) {
    const events = await pool.query(
      `SELECT te.*, bi.title AS bucket_item_title FROM timeline_events te
       LEFT JOIN bucket_items bi ON bi.id = te.bucket_item_id
       WHERE te.trip_id = $1 ORDER BY te.day_number, te.sequence`, [tripId])
    return attachEventDetails(events.rows)
  }

  app.get('/api/trips/:tripId/events', async (req, res) => {
    res.json(await loadEvents(req.params.tripId))
  })

  app.post('/api/trips/:tripId/events', async (req, res) => {
    const { placeId, dayNumber } = req.body as { placeId: string; dayNumber: number | null }
    const eventId = id()
    if (dayNumber == null) {
      await pool.query(
        'INSERT INTO timeline_events (id, trip_id, place_id, day_number, sequence) VALUES ($1,$2,$3,NULL,0)',
        [eventId, req.params.tripId, placeId])
    } else {
      const max = await pool.query(
        'SELECT COALESCE(MAX(sequence), 0) AS m FROM timeline_events WHERE trip_id = $1 AND day_number = $2',
        [req.params.tripId, dayNumber])
      await pool.query(
        'INSERT INTO timeline_events (id, trip_id, place_id, day_number, sequence) VALUES ($1,$2,$3,$4,$5)',
        [eventId, req.params.tripId, placeId, dayNumber, Number(max.rows[0].m) + 1])
    }
    const placeRow = await pool.query('SELECT name FROM places WHERE id = $1', [placeId])
    await logActivity(req.params.tripId, 'event_added', placeRow.rows[0]?.name ?? '장소')
    res.json({ id: eventId })
  })

  // 미배정 티켓(발렛/항공/숙소)을 특정 일차로 배치
  app.put('/api/trips/:tripId/events/:id/assign-day', async (req, res) => {
    const { dayNumber } = req.body as { dayNumber: number }
    const max = await pool.query(
      'SELECT COALESCE(MAX(sequence), 0) AS m FROM timeline_events WHERE trip_id = $1 AND day_number = $2',
      [req.params.tripId, dayNumber])
    await pool.query(
      'UPDATE timeline_events SET day_number=$1, sequence=$2 WHERE id=$3 AND trip_id=$4',
      [dayNumber, Number(max.rows[0].m) + 1, req.params.id, req.params.tripId])
    res.json({ ok: true })
  })

  app.put('/api/events/:id', async (req, res) => {
    const { rating, review, linkUrl, mustTry, memo, plannedTime, bucketItemId } = req.body as {
      rating: number | null; review: string | null; linkUrl: string | null; mustTry: string | null
      memo: string | null; plannedTime: string | null; bucketItemId?: string | null
    }
    const sets = ['rating=$1', 'review=$2', 'link_url=$3', 'must_try=$4', 'planned_time=$5', 'memo=$6']
    const params: any[] = [rating, review, linkUrl, mustTry, plannedTime, memo]
    if (bucketItemId !== undefined) { params.push(bucketItemId); sets.push(`bucket_item_id=$${params.length}`) }
    params.push(req.params.id)
    await pool.query(`UPDATE timeline_events SET ${sets.join(', ')} WHERE id=$${params.length}`, params)
    if (bucketItemId) {
      const ev = await pool.query('SELECT trip_id FROM timeline_events WHERE id = $1', [req.params.id])
      if (ev.rows[0]) {
        await pool.query('UPDATE bucket_items SET done = true, linked_trip_id = $1 WHERE id = $2',
          [ev.rows[0].trip_id, bucketItemId])
      }
    }
    res.json({ ok: true })
  })

  app.post('/api/trips/:tripId/events/reorder', async (req, res) => {
    const { dayNumber, orderedIds } = req.body as { dayNumber: number; orderedIds: string[] }
    if (orderedIds.length > 0) {
      // 항목마다 UPDATE 왕복하는 대신, id·순번 배열을 unnest해서 한 번의 쿼리로 전부 갱신한다.
      // 단일 문장이라 그 자체로 원자적 — 별도 트랜잭션이 필요 없다.
      await pool.query(
        `UPDATE timeline_events AS te SET sequence = v.seq
         FROM (SELECT unnest($1::text[]) AS id, unnest($2::int[]) AS seq) AS v
         WHERE te.id = v.id AND te.trip_id = $3 AND te.day_number = $4`,
        [orderedIds, orderedIds.map((_, i) => i + 1), req.params.tripId, dayNumber])
    }
    res.json({ ok: true })
  })

  app.delete('/api/events/:id', async (req, res) => {
    // CASCADE로 지워지는 사진·항공사 로고의 R2 파일도 함께 정리 (여행 삭제와 같은 이유)
    const [photos, logo] = await Promise.all([
      pool.query('SELECT file_path FROM photos WHERE event_id = $1', [req.params.id]),
      pool.query('SELECT airline_logo_path FROM flight_details WHERE event_id = $1', [req.params.id]),
    ])
    await pool.query('DELETE FROM timeline_events WHERE id = $1', [req.params.id])
    const filePaths = [
      ...photos.rows.map((r) => r.file_path as string),
      ...(logo.rows[0]?.airline_logo_path ? [logo.rows[0].airline_logo_path as string] : []),
    ]
    await Promise.all(filePaths.map((p) => safeUnlink(p)))
    res.json({ ok: true })
  })

  // ── 항공 상세 (공항 이벤트 1:1) ────────────────────────
  app.put('/api/events/:id/flight', async (req, res) => {
    const {
      departAt, arriveAt, durationMinutes, bookingRef, bookedVia, departureLocation, confirmed, voucherId,
      airline, flightNo, destination, destinationPlaceId, gate, seat, passengerIds,
    } = req.body as {
      departAt: string | null; arriveAt: string | null; durationMinutes: number | null
      bookingRef: string | null; bookedVia: string | null
      departureLocation: string | null; confirmed: boolean; voucherId: string | null
      airline: string | null; flightNo: string | null; destination: string | null; destinationPlaceId?: string | null
      gate: string | null; seat: string | null; passengerIds?: string[]
    }
    await pool.query(
      `INSERT INTO flight_details
         (event_id, depart_at, arrive_at, duration_minutes, booking_ref, booked_via, departure_location, confirmed, voucher_id,
          airline, flight_no, destination, gate, seat, passenger_ids, destination_place_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (event_id) DO UPDATE SET
         depart_at = excluded.depart_at, arrive_at = excluded.arrive_at, duration_minutes = excluded.duration_minutes,
         booking_ref = excluded.booking_ref, booked_via = excluded.booked_via,
         departure_location = excluded.departure_location, confirmed = excluded.confirmed, voucher_id = excluded.voucher_id,
         airline = excluded.airline, flight_no = excluded.flight_no, destination = excluded.destination,
         gate = excluded.gate, seat = excluded.seat, passenger_ids = excluded.passenger_ids,
         destination_place_id = excluded.destination_place_id`,
      [req.params.id, departAt, arriveAt, durationMinutes, bookingRef, bookedVia, departureLocation, !!confirmed, voucherId,
        airline?.trim() || null, flightNo?.trim() || null, destination?.trim() || null,
        gate?.trim() || null, seat?.trim() || null, passengerIds ?? [], destinationPlaceId || null])
    res.json({ ok: true })
  })

  app.post('/api/events/:id/flight/logo', uploader.array('files', 1), async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[]
    const file = files[0]
    if (!file) { res.status(400).json({ error: '파일이 없어요.' }); return }
    const rel = await uploadFile('flight-logos', file)
    const old = await pool.query('SELECT airline_logo_path FROM flight_details WHERE event_id = $1', [req.params.id])
    if (old.rows[0]?.airline_logo_path) await safeUnlink(old.rows[0].airline_logo_path)
    await pool.query(
      `INSERT INTO flight_details (event_id, airline_logo_path) VALUES ($1,$2)
       ON CONFLICT (event_id) DO UPDATE SET airline_logo_path = excluded.airline_logo_path`,
      [req.params.id, rel])
    const r = await pool.query(`${FLIGHT_SELECT} WHERE fd.event_id = $1`, [req.params.id])
    res.json(mapFlightDetail(r.rows[0]))
  })

  app.delete('/api/events/:id/flight', async (req, res) => {
    const old = await pool.query('SELECT airline_logo_path FROM flight_details WHERE event_id = $1', [req.params.id])
    if (old.rows[0]?.airline_logo_path) await safeUnlink(old.rows[0].airline_logo_path)
    await pool.query('DELETE FROM flight_details WHERE event_id = $1', [req.params.id])
    res.json({ ok: true })
  })

  // ── 발렛 상세 (발렛 이벤트 1:1) ────────────────────────
  app.put('/api/events/:id/valet', async (req, res) => {
    const { scheduledAt, location, company, bookedVia, bookingRef, confirmed, voucherId, note } = req.body as {
      scheduledAt: string | null; location: string | null; company: string | null
      bookedVia: string | null; bookingRef: string | null; confirmed: boolean
      voucherId: string | null; note: string | null
    }
    await pool.query(
      `INSERT INTO valet_details (event_id, scheduled_at, location, company, booked_via, booking_ref, confirmed, voucher_id, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (event_id) DO UPDATE SET
         scheduled_at = excluded.scheduled_at, location = excluded.location, company = excluded.company,
         booked_via = excluded.booked_via, booking_ref = excluded.booking_ref, confirmed = excluded.confirmed,
         voucher_id = excluded.voucher_id, note = excluded.note`,
      [req.params.id, scheduledAt, location?.trim() || null, company?.trim() || null,
        bookedVia?.trim() || null, bookingRef?.trim() || null, !!confirmed, voucherId || null, note?.trim() || null])
    res.json({ ok: true })
  })

  // ── 숙소 상세 (숙소 이벤트 1:1) ────────────────────────
  app.put('/api/events/:id/lodging', async (req, res) => {
    const { checkInAt, checkOutAt, bookingRef, bookedVia, confirmed, voucherId, note, breakfastIncluded, roomType } = req.body as {
      checkInAt: string | null; checkOutAt: string | null
      bookingRef: string | null; bookedVia: string | null; confirmed: boolean
      voucherId: string | null; note: string | null
      breakfastIncluded?: boolean; roomType?: string | null
    }
    await pool.query(
      `INSERT INTO lodging_details
         (event_id, check_in_at, check_out_at, booking_ref, booked_via, confirmed, voucher_id, note, breakfast_included, room_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (event_id) DO UPDATE SET
         check_in_at = excluded.check_in_at, check_out_at = excluded.check_out_at,
         booking_ref = excluded.booking_ref, booked_via = excluded.booked_via, confirmed = excluded.confirmed,
         voucher_id = excluded.voucher_id, note = excluded.note,
         breakfast_included = excluded.breakfast_included, room_type = excluded.room_type`,
      [req.params.id, checkInAt, checkOutAt, bookingRef?.trim() || null, bookedVia?.trim() || null,
        !!confirmed, voucherId || null, note?.trim() || null, !!breakfastIncluded, roomType?.trim() || null])
    res.json({ ok: true })
  })

  // ── 예약 상세 (맛집·카페 등 일반 장소 이벤트 1:1) ──────
  app.put('/api/events/:id/reservation', async (req, res) => {
    const { reservedAt, partySize, bookingRef, bookedVia, confirmed, voucherId, note } = req.body as {
      reservedAt: string | null; partySize: number | null
      bookingRef: string | null; bookedVia: string | null; confirmed: boolean
      voucherId: string | null; note: string | null
    }
    await pool.query(
      `INSERT INTO reservation_details (event_id, reserved_at, party_size, booking_ref, booked_via, confirmed, voucher_id, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (event_id) DO UPDATE SET
         reserved_at = excluded.reserved_at, party_size = excluded.party_size,
         booking_ref = excluded.booking_ref, booked_via = excluded.booked_via, confirmed = excluded.confirmed,
         voucher_id = excluded.voucher_id, note = excluded.note`,
      [req.params.id, reservedAt || null, partySize ?? null, bookingRef?.trim() || null,
        bookedVia?.trim() || null, !!confirmed, voucherId || null, note?.trim() || null])
    res.json({ ok: true })
  })

  app.delete('/api/events/:id/reservation', async (req, res) => {
    await pool.query('DELETE FROM reservation_details WHERE event_id = $1', [req.params.id])
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
    // 정산 대상(splits)은 지출마다 쿼리하지 않고 array_agg 서브쿼리로 한 번에 가져온다
    // (expense_splits PK가 (expense_id, member_id)라 인덱스 스캔으로 처리됨).
    const r = await pool.query(
      `SELECT e.*, m.name AS payer_name,
         COALESCE((SELECT array_agg(es.member_id) FROM expense_splits es WHERE es.expense_id = e.id), '{}') AS split_with
       FROM expenses e
       JOIN members m ON m.id = e.paid_by
       WHERE e.trip_id = $1 ORDER BY e.spent_at DESC`, [req.params.tripId])
    res.json(r.rows.map((row) => ({ ...mapExpense(row), splitWith: row.split_with ?? [] })))
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
    if ((splitWith ?? []).length > 0) {
      const values = splitWith.map((_, i) => `($1, $${i + 2})`).join(', ')
      await pool.query(`INSERT INTO expense_splits (expense_id, member_id) VALUES ${values}`, [expenseId, ...splitWith])
    }
    await logActivity(req.params.tripId, 'expense_added', `${description.trim()} (${amount.toLocaleString()} ${currency})`)
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

  app.post('/api/trips/:tripId/vouchers', uploader.array('files', 10), async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[]
    const category = ((req.body?.category as string | undefined) ?? '기타').trim() || '기타'
    const added = []
    for (const f of files) {
      const voucherId = id()
      const originalName = decodeOriginalName(f.originalname)
      const rel = await uploadFile('vouchers', f)
      const fileType = path.extname(originalName).replace('.', '').toUpperCase() || 'FILE'
      await pool.query('INSERT INTO vouchers (id, trip_id, title, file_type, file_path, category) VALUES ($1,$2,$3,$4,$5,$6)',
        [voucherId, req.params.tripId, originalName, fileType, rel, category])
      added.push({ id: voucherId, tripId: req.params.tripId, title: originalName, fileType, filePath: rel, category })
    }
    res.json(added)
  })

  app.delete('/api/vouchers/:id', async (req, res) => {
    const r = await pool.query('SELECT file_path FROM vouchers WHERE id = $1', [req.params.id])
    await pool.query('DELETE FROM vouchers WHERE id = $1', [req.params.id])
    if (r.rows[0]) await safeUnlink(r.rows[0].file_path)
    res.json({ ok: true })
  })

  // ── 사진 ──────────────────────────────────────────────
  app.post('/api/events/:eventId/photos', uploader.array('files', 10), async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[]
    const added = []
    for (const f of files) {
      const photoId = id()
      const rel = await uploadFile('photos', f)
      await pool.query('INSERT INTO photos (id, event_id, file_path) VALUES ($1,$2,$3)', [photoId, req.params.eventId, rel])
      added.push({ id: photoId, eventId: req.params.eventId, filePath: rel })
    }
    res.json(added)
  })

  app.delete('/api/photos/:id', async (req, res) => {
    const r = await pool.query('SELECT file_path FROM photos WHERE id = $1', [req.params.id])
    await pool.query('DELETE FROM photos WHERE id = $1', [req.params.id])
    if (r.rows[0]) await safeUnlink(r.rows[0].file_path)
    res.json({ ok: true })
  })

  // ── 보관함 ────────────────────────────────────────────
  const ARCHIVE_SELECT = `
    SELECT a.*, p.name AS linked_place_name
    FROM archive_items a
    LEFT JOIN places p ON p.id = a.linked_place_id
  `

  app.get('/api/trips/:tripId/archive', async (req, res) => {
    const r = await pool.query(`${ARCHIVE_SELECT} WHERE a.trip_id = $1 ORDER BY a.created_at DESC`, [req.params.tripId])
    res.json(r.rows.map(mapArchive))
  })

  // SNS 아카이브 — 어느 여행에도 속하지 않은 링크 보관함(나중에 실제 장소로 등록해서 족보에 편입)
  app.get('/api/archive', async (_req, res) => {
    const r = await pool.query(`${ARCHIVE_SELECT} WHERE a.trip_id IS NULL ORDER BY a.created_at DESC`)
    res.json(r.rows.map(mapArchive))
  })

  app.post('/api/archive/link', async (req, res) => {
    const { title, url } = req.body as { title: string; url: string }
    const itemId = id()
    await pool.query('INSERT INTO archive_items (id, trip_id, kind, title, body) VALUES ($1,$2,$3,$4,$5)',
      [itemId, null, 'link', title.trim() || url.trim(), url.trim()])
    const r = await pool.query(`${ARCHIVE_SELECT} WHERE a.id = $1`, [itemId])
    res.json(mapArchive(r.rows[0]))
  })

  app.put('/api/archive/:id', async (req, res) => {
    const { linkedPlaceId } = req.body as { linkedPlaceId: string | null }
    await pool.query('UPDATE archive_items SET linked_place_id = $1 WHERE id = $2', [linkedPlaceId, req.params.id])
    res.json({ ok: true })
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

  app.post('/api/trips/:tripId/archive/image', uploader.array('files', 10), async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[]
    const added = []
    for (const f of files) {
      const itemId = id()
      const originalName = decodeOriginalName(f.originalname)
      const rel = await uploadFile('archive', f)
      await pool.query('INSERT INTO archive_items (id, trip_id, kind, title, file_path) VALUES ($1,$2,$3,$4,$5)',
        [itemId, req.params.tripId, 'image', originalName, rel])
      added.push({ id: itemId, tripId: req.params.tripId, kind: 'image', title: originalName, body: null, filePath: rel })
    }
    res.json(added)
  })

  app.delete('/api/archive/:id', async (req, res) => {
    const r = await pool.query('SELECT file_path FROM archive_items WHERE id = $1', [req.params.id])
    await pool.query('DELETE FROM archive_items WHERE id = $1', [req.params.id])
    if (r.rows[0]?.file_path) await safeUnlink(r.rows[0].file_path)
    res.json({ ok: true })
  })

  app.post('/api/archive/:id/convert', async (req, res) => {
    const { tripId, dayNumber } = req.body as { tripId: string; dayNumber: number }
    const itemRow = await pool.query('SELECT * FROM archive_items WHERE id = $1', [req.params.id])
    const item = itemRow.rows[0]
    if (!item) { res.status(404).json({ error: '보관함 항목을 찾을 수 없어요.' }); return }

    // 장소 생성 + 일정 생성 + 사진 이관 + 원본 삭제 4단계가 한 번에 성공/실패해야 한다
    // (중간에 실패하면 "장소만 생기고 일정은 없는" 반쪽 상태가 남을 수 있음).
    await withTransaction(async (db) => {
      const placeId = id()
      await db.query('INSERT INTO places (id, name, address, category) VALUES ($1,$2,$3,$4)',
        [placeId, item.title, '', '기타'])

      const max = await db.query(
        'SELECT COALESCE(MAX(sequence), 0) AS m FROM timeline_events WHERE trip_id = $1 AND day_number = $2',
        [tripId, dayNumber])
      const eventId = id()
      const review = item.kind === 'memo' ? item.body : null
      const linkUrl = item.kind === 'link' ? item.body : null
      await db.query(
        'INSERT INTO timeline_events (id, trip_id, place_id, day_number, sequence, review, link_url) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [eventId, tripId, placeId, dayNumber, Number(max.rows[0].m) + 1, review, linkUrl])

      if (item.kind === 'image' && item.file_path) {
        await db.query('INSERT INTO photos (id, event_id, file_path) VALUES ($1,$2,$3)', [id(), eventId, item.file_path])
      }
      await db.query('DELETE FROM archive_items WHERE id = $1', [item.id])
    })
    res.json({ ok: true })
  })

  // ── 일차 메모(그날의 기록·날씨) ───────────────────────
  app.get('/api/trips/:tripId/day-notes', async (req, res) => {
    const r = await pool.query('SELECT * FROM day_notes WHERE trip_id = $1', [req.params.tripId])
    const photosR = await pool.query(
      'SELECT * FROM day_note_photos WHERE trip_id = $1 ORDER BY created_at', [req.params.tripId])
    const photosByDay = new Map<number, Array<{ id: string; dayNumber: number; filePath: string }>>()
    for (const p of photosR.rows) {
      const list = photosByDay.get(p.day_number) ?? []
      list.push({ id: p.id, dayNumber: p.day_number, filePath: p.file_path })
      photosByDay.set(p.day_number, list)
    }
    const dayNumbers = new Set([...r.rows.map((row) => row.day_number), ...photosByDay.keys()])
    const byDayNumber = new Map(r.rows.map((row) => [row.day_number, row]))
    res.json([...dayNumbers].map((dayNumber) => {
      const row = byDayNumber.get(dayNumber)
      return {
        tripId: req.params.tripId, dayNumber, note: row?.note ?? null, diary: row?.diary ?? null,
        weatherEmoji: row?.weather_emoji ?? null, weatherTemp: row?.weather_temp != null ? Number(row.weather_temp) : null,
        cityIds: row?.city_ids ?? [], budget: row?.budget != null ? Number(row.budget) : null,
        photos: photosByDay.get(dayNumber) ?? [],
      }
    }))
  })

  app.put('/api/trips/:tripId/day-notes/:dayNumber', async (req, res) => {
    const { note, diary, weatherEmoji, weatherTemp, cityIds, budget } = req.body as {
      note: string | null; diary: string | null; weatherEmoji: string | null; weatherTemp: number | null
      cityIds: string[]; budget: number | null
    }
    await pool.query(
      `INSERT INTO day_notes (trip_id, day_number, note, diary, weather_emoji, weather_temp, city_ids, budget) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (trip_id, day_number) DO UPDATE SET
         note = excluded.note, diary = excluded.diary,
         weather_emoji = excluded.weather_emoji, weather_temp = excluded.weather_temp,
         city_ids = excluded.city_ids, budget = excluded.budget`,
      [req.params.tripId, Number(req.params.dayNumber), note, diary, weatherEmoji, weatherTemp, cityIds ?? [], budget])
    res.json({ ok: true })
  })

  app.post('/api/trips/:tripId/day-notes/:dayNumber/photos',
    uploader.array('files', 20), async (req, res) => {
      const dayNumber = Number(req.params.dayNumber)
      await pool.query(
        'INSERT INTO day_notes (trip_id, day_number) VALUES ($1,$2) ON CONFLICT (trip_id, day_number) DO NOTHING',
        [req.params.tripId, dayNumber])
      const files = (req.files ?? []) as Express.Multer.File[]
      const added = []
      for (const f of files) {
        const photoId = id()
        const rel = await uploadFile('day-photos', f)
        await pool.query('INSERT INTO day_note_photos (id, trip_id, day_number, file_path) VALUES ($1,$2,$3,$4)',
          [photoId, req.params.tripId, dayNumber, rel])
        added.push({ id: photoId, dayNumber, filePath: rel })
      }
      res.json(added)
    })

  // 여러 장을 한번에 올리면 EXIF 촬영일시를 읽어 해당 일차 일기에 자동으로 나눠 넣는다.
  // EXIF가 없는 사진(스크린샷 등)은 여행 중이면 오늘 일차, 아니면 1일차로 떨어진다.
  app.post('/api/trips/:tripId/day-notes/photos/auto', uploader.array('files', 30), async (req, res) => {
    const tripRow = await pool.query('SELECT start_date, end_date FROM trips WHERE id = $1', [req.params.tripId])
    const trip = tripRow.rows[0]
    if (!trip) { res.status(404).json({ error: '여행을 찾을 수 없어요.' }); return }
    const startDate = new Date(`${trip.start_date}T00:00:00`)
    const endDate = new Date(`${trip.end_date}T00:00:00`)
    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const fallbackDay = today >= startDate && today <= endDate
      ? Math.round((today.getTime() - startDate.getTime()) / 86_400_000) + 1
      : 1

    const files = (req.files ?? []) as Express.Multer.File[]
    const added: Array<{ id: string; dayNumber: number; filePath: string }> = []
    const daysTouched = new Set<number>()

    for (const f of files) {
      const taken = await extractTakenDate(f)
      let dayNumber = fallbackDay
      if (taken) {
        taken.setHours(0, 0, 0, 0)
        const diff = Math.round((taken.getTime() - startDate.getTime()) / 86_400_000) + 1
        dayNumber = Math.min(Math.max(diff, 1), totalDays)
      }
      await pool.query(
        'INSERT INTO day_notes (trip_id, day_number) VALUES ($1,$2) ON CONFLICT (trip_id, day_number) DO NOTHING',
        [req.params.tripId, dayNumber])
      const rel = await uploadFile('day-photos', f)
      const photoId = id()
      await pool.query('INSERT INTO day_note_photos (id, trip_id, day_number, file_path) VALUES ($1,$2,$3,$4)',
        [photoId, req.params.tripId, dayNumber, rel])
      added.push({ id: photoId, dayNumber, filePath: rel })
      daysTouched.add(dayNumber)
    }
    res.json({ photos: added, dayCount: daysTouched.size })
  })

  app.delete('/api/day-note-photos/:id', async (req, res) => {
    const r = await pool.query('SELECT file_path FROM day_note_photos WHERE id = $1', [req.params.id])
    await pool.query('DELETE FROM day_note_photos WHERE id = $1', [req.params.id])
    if (r.rows[0]) await safeUnlink(r.rows[0].file_path)
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
    const { scope, dayNumber, text, category } = req.body as {
      scope: string; dayNumber: number | null; text: string; category?: string | null
    }
    const max = await pool.query(
      'SELECT COALESCE(MAX(sequence), 0) AS m FROM checklist_items WHERE trip_id = $1 AND scope = $2 AND day_number IS NOT DISTINCT FROM $3',
      [req.params.tripId, scope, dayNumber])
    const itemId = id()
    await pool.query(
      'INSERT INTO checklist_items (id, trip_id, scope, day_number, text, category, sequence) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [itemId, req.params.tripId, scope, dayNumber, text.trim(), category ?? null, Number(max.rows[0].m) + 1])
    const r = await pool.query('SELECT * FROM checklist_items WHERE id = $1', [itemId])
    res.json(mapChecklist(r.rows[0]))
  })

  app.post('/api/trips/:tripId/checklist/seed-presets', async (req, res) => {
    const scope = req.body?.scope as string
    if (scope !== 'predeparture' && scope !== 'packing') {
      res.status(400).json({ error: 'scope는 predeparture 또는 packing이어야 해요.' })
      return
    }
    await seedChecklistPresets(req.params.tripId, scope)
    res.json({ ok: true })
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
    SELECT b.*, t.title AS linked_trip_title, p.name AS linked_place_name
    FROM bucket_items b
    LEFT JOIN trips t ON t.id = b.linked_trip_id
    LEFT JOIN places p ON p.id = b.linked_place_id
  `

  app.get('/api/bucket', async (_req, res) => {
    const r = await pool.query(`${BUCKET_SELECT} ORDER BY b.done, b.created_at DESC`)
    res.json(r.rows.map(mapBucket))
  })

  app.post('/api/bucket', async (req, res) => {
    const { title, memo, tip, countryIds, cityIds, category, linkedPlaceId, linkedTripId } = req.body as {
      title: string; memo: string | null; tip?: string | null; countryIds: string[]; cityIds: string[]
      category: string | null; linkedPlaceId?: string | null; linkedTripId?: string | null
    }
    const itemId = id()
    await pool.query(
      'INSERT INTO bucket_items (id, title, memo, tip, country_ids, city_ids, category, linked_place_id, linked_trip_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [itemId, title.trim(), memo, tip ?? null, countryIds ?? [], cityIds ?? [], category, linkedPlaceId || null, linkedTripId || null])
    await logActivity(linkedTripId || null, 'bucket_added', title.trim())
    const r = await pool.query(`${BUCKET_SELECT} WHERE b.id = $1`, [itemId])
    res.json(mapBucket(r.rows[0]))
  })

  app.put('/api/bucket/:id', async (req, res) => {
    const { done, linkedTripId, linkedPlaceId, memo, tip } = req.body as {
      done?: boolean; linkedTripId?: string | null; linkedPlaceId?: string | null
      memo?: string | null; tip?: string | null
    }
    const sets: string[] = []
    const params: any[] = []
    if (done !== undefined) { params.push(done); sets.push(`done = $${params.length}`) }
    if (linkedTripId !== undefined) { params.push(linkedTripId); sets.push(`linked_trip_id = $${params.length}`) }
    if (linkedPlaceId !== undefined) { params.push(linkedPlaceId); sets.push(`linked_place_id = $${params.length}`) }
    if (memo !== undefined) { params.push(memo); sets.push(`memo = $${params.length}`) }
    if (tip !== undefined) { params.push(tip); sets.push(`tip = $${params.length}`) }
    if (sets.length > 0) {
      params.push(req.params.id)
      await pool.query(`UPDATE bucket_items SET ${sets.join(', ')} WHERE id = $${params.length}`, params)
    }
    // 완료로 표시됐는데 아직 여행이 안 이어져 있으면, 국가/도시가 겹치는 여행 중
    // 오늘 날짜에서 가장 가까운(막 다녀왔을 확률이 높은) 여행으로 자동 연결한다.
    if (done === true && linkedTripId === undefined) {
      const itemR = await pool.query('SELECT country_ids, city_ids, linked_trip_id FROM bucket_items WHERE id = $1', [req.params.id])
      const item = itemR.rows[0] as { country_ids: string[]; city_ids: string[]; linked_trip_id: string | null } | undefined
      if (item && !item.linked_trip_id && (item.city_ids.length > 0 || item.country_ids.length > 0)) {
        const match = await pool.query(
          `SELECT t.id
           FROM trips t
           JOIN trip_cities tc ON tc.trip_id = t.id
           JOIN cities c ON c.id = tc.city_id
           WHERE c.id = ANY($1::text[]) OR c.country_id = ANY($2::text[])
           ORDER BY LEAST(ABS(t.start_date::date - CURRENT_DATE), ABS(t.end_date::date - CURRENT_DATE)) ASC
           LIMIT 1`,
          [item.city_ids, item.country_ids])
        if (match.rows[0]) {
          await pool.query('UPDATE bucket_items SET linked_trip_id = $1 WHERE id = $2', [match.rows[0].id, req.params.id])
        }
      }
    }
    res.json({ ok: true })
  })

  app.delete('/api/bucket/:id', async (req, res) => {
    const old = await pool.query('SELECT image_path FROM bucket_items WHERE id = $1', [req.params.id])
    await pool.query('DELETE FROM bucket_items WHERE id = $1', [req.params.id])
    if (old.rows[0]?.image_path) await safeUnlink(old.rows[0].image_path)
    res.json({ ok: true })
  })

  app.post('/api/bucket/:id/photo', uploader.array('files', 1), async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[]
    const file = files[0]
    if (!file) { res.status(400).json({ error: '파일이 없어요.' }); return }
    const rel = await uploadFile('bucket', file)
    const old = await pool.query('SELECT image_path FROM bucket_items WHERE id = $1', [req.params.id])
    if (old.rows[0]?.image_path) await safeUnlink(old.rows[0].image_path)
    await pool.query('UPDATE bucket_items SET image_path = $1 WHERE id = $2', [rel, req.params.id])
    const r = await pool.query(`${BUCKET_SELECT} WHERE b.id = $1`, [req.params.id])
    res.json(mapBucket(r.rows[0]))
  })

  app.delete('/api/bucket/:id/photo', async (req, res) => {
    const old = await pool.query('SELECT image_path FROM bucket_items WHERE id = $1', [req.params.id])
    if (old.rows[0]?.image_path) await safeUnlink(old.rows[0].image_path)
    await pool.query('UPDATE bucket_items SET image_path = NULL WHERE id = $1', [req.params.id])
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

  // ── 대시보드 (여행 전체를 아우르는 요약·캘린더·사진첩) ─────
  app.get('/api/dashboard', async (_req, res) => {
    const tripsR = await pool.query(`SELECT t.*, ${TRIP_CITIES_SUBQUERY} FROM trips t ORDER BY t.start_date DESC`)
    const trips = tripsR.rows.map(mapTrip)

    const expensesR = await pool.query('SELECT trip_id, amount, currency FROM expenses')
    const ratesR = await pool.query('SELECT trip_id, currency, krw_per_unit FROM trip_currency_rates')
    const ratesByTrip = new Map<string, Map<string, number>>()
    for (const r of ratesR.rows) {
      const m = ratesByTrip.get(r.trip_id) ?? new Map<string, number>()
      m.set(r.currency, Number(r.krw_per_unit))
      ratesByTrip.set(r.trip_id, m)
    }
    const spendByTrip = new Map<string, number>()
    for (const e of expensesR.rows) {
      const krw = e.currency === 'KRW' ? Number(e.amount)
        : (() => { const rate = ratesByTrip.get(e.trip_id)?.get(e.currency); return rate != null ? Number(e.amount) * rate : null })()
      if (krw == null) continue
      spendByTrip.set(e.trip_id, (spendByTrip.get(e.trip_id) ?? 0) + krw)
    }

    let totalSpentKrw = 0
    let domesticTrips = 0
    let internationalTrips = 0
    let totalDays = 0
    let maxSpendTrip: { title: string; amount: number } | null = null
    let minSpendTrip: { title: string; amount: number } | null = null
    for (const t of trips) {
      const spend = spendByTrip.get(t.id) ?? 0
      totalSpentKrw += spend
      const isDomestic = t.cities.length > 0 && t.cities.every((c: { countryCode: string | null }) => c.countryCode === 'KR')
      if (isDomestic) domesticTrips++; else internationalTrips++
      const s = new Date(t.startDate + 'T00:00:00')
      const e = new Date(t.endDate + 'T00:00:00')
      totalDays += Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1)
      if (maxSpendTrip == null || spend > maxSpendTrip.amount) maxSpendTrip = { title: t.title, amount: spend }
      if (minSpendTrip == null || spend < minSpendTrip.amount) minSpendTrip = { title: t.title, amount: spend }
    }

    const bucketCountR = await pool.query('SELECT COUNT(*)::int AS c FROM bucket_items')

    // 캘린더 사진: 일차 번호를 여행 시작일 기준 실제 날짜로 변환
    const dayPhotosR = await pool.query(
      `SELECT dnp.day_number, dnp.file_path, dnp.created_at, t.start_date
       FROM day_note_photos dnp JOIN trips t ON t.id = dnp.trip_id
       ORDER BY dnp.created_at`)
    const calendarPhotoByDate = new Map<string, string>()
    for (const row of dayPhotosR.rows) {
      const s = new Date(row.start_date + 'T00:00:00')
      s.setDate(s.getDate() + Number(row.day_number) - 1)
      const iso = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`
      if (!calendarPhotoByDate.has(iso)) calendarPhotoByDate.set(iso, row.file_path)
    }

    // 사진첩: 오늘의 일기 사진(일기 텍스트를 캡션으로) + 일정 사진(장소명을 캡션으로)
    const diaryPhotosR = await pool.query(
      `SELECT dnp.id, dnp.file_path, dnp.created_at, dn.diary
       FROM day_note_photos dnp
       LEFT JOIN day_notes dn ON dn.trip_id = dnp.trip_id AND dn.day_number = dnp.day_number
       ORDER BY dnp.created_at DESC LIMIT 300`)
    const eventPhotosR = await pool.query(
      `SELECT ph.id, ph.file_path, ph.created_at, p.name AS place_name
       FROM photos ph JOIN timeline_events te ON te.id = ph.event_id JOIN places p ON p.id = te.place_id
       ORDER BY ph.created_at DESC LIMIT 300`)
    const gallery = [
      ...diaryPhotosR.rows.map((r) => ({
        id: r.id, filePath: r.file_path, createdAt: r.created_at,
        caption: r.diary ? (r.diary.length > 40 ? `${r.diary.slice(0, 40)}…` : r.diary) : null,
      })),
      ...eventPhotosR.rows.map((r) => ({
        id: r.id, filePath: r.file_path, createdAt: r.created_at, caption: r.place_name ?? null,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    res.json({
      summary: {
        totalTrips: trips.length, domesticTrips, internationalTrips, totalDays,
        bucketCount: Number(bucketCountR.rows[0].c), totalSpentKrw, maxSpendTrip, minSpendTrip,
      },
      calendarPhotos: [...calendarPhotoByDate.entries()].map(([date, filePath]) => ({ date, filePath })),
      gallery,
    })
  })

  // 최근 활동 피드 — 가족 누구나 "방금 뭐가 추가됐는지" 확인용
  app.get('/api/activity', async (req, res) => {
    const limit = Math.min(50, Number(req.query.limit) || 20)
    const r = await pool.query(
      `SELECT al.*, t.title AS trip_title FROM activity_log al
       LEFT JOIN trips t ON t.id = al.trip_id
       ORDER BY al.created_at DESC LIMIT $1`,
      [limit])
    res.json(r.rows.map((row) => ({
      id: row.id, tripId: row.trip_id, tripTitle: row.trip_title ?? null,
      action: row.action, summary: row.summary, createdAt: row.created_at,
    })))
  })
}
