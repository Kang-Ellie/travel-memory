import crypto from 'node:crypto'
import path from 'node:path'
import type { Express as ExpressApp, Request, Response } from 'express'
import { pool } from './db.js'
import { makeUploader, relativeFilePath, safeUnlink, absoluteFromRelative, UPLOAD_DIR } from './upload.js'
import { requireAuth, makeSessionToken, verifySessionToken, cookieOptions, SESSION_COOKIE } from './auth.js'

const id = (): string => crypto.randomUUID()

const photoUploader = makeUploader('photos')
const voucherUploader = makeUploader('vouchers')
const archiveUploader = makeUploader('archive')

// ── 행 매핑 (snake_case DB → camelCase API) ──────────────
const mapTrip = (r: any) => ({
  id: r.id, title: r.title, startDate: r.start_date, endDate: r.end_date,
  budget: Number(r.budget), createdAt: r.created_at,
})
const mapMember = (r: any) => ({ id: r.id, name: r.name })
const mapPlace = (r: any) => ({
  id: r.id, name: r.name, address: r.address, category: r.category,
  lat: r.lat != null ? Number(r.lat) : null, lng: r.lng != null ? Number(r.lng) : null,
  memo: r.memo, createdAt: r.created_at,
})
const mapEvent = (r: any) => ({
  id: r.id, tripId: r.trip_id, placeId: r.place_id, dayNumber: r.day_number, sequence: r.sequence,
  plannedTime: r.planned_time, rating: r.rating != null ? Number(r.rating) : null,
  review: r.review, mustTry: r.must_try, linkUrl: r.link_url, createdAt: r.created_at,
})
const mapExpense = (r: any) => ({
  id: r.id, tripId: r.trip_id, eventId: r.event_id, amount: Number(r.amount), currency: r.currency,
  category: r.category, description: r.description, paidBy: r.paid_by, payerName: r.payer_name,
  spentAt: r.spent_at,
})
const mapVoucher = (r: any) => ({
  id: r.id, tripId: r.trip_id, title: r.title, fileType: r.file_type, filePath: r.file_path, createdAt: r.created_at,
})
const mapPhoto = (r: any) => ({ id: r.id, eventId: r.event_id, filePath: r.file_path })
const mapArchive = (r: any) => ({
  id: r.id, tripId: r.trip_id, kind: r.kind, title: r.title, body: r.body, filePath: r.file_path, createdAt: r.created_at,
})

export function registerRoutes(app: ExpressApp): void {
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
    const r = await pool.query('SELECT * FROM trips ORDER BY start_date DESC')
    res.json(r.rows.map(mapTrip))
  })

  app.post('/api/trips', async (req, res) => {
    const { title, startDate, endDate, budget, memberIds } = req.body as {
      title: string; startDate: string; endDate: string; budget: number; memberIds: string[]
    }
    const tripId = id()
    await pool.query('INSERT INTO trips (id, title, start_date, end_date, budget) VALUES ($1,$2,$3,$4,$5)',
      [tripId, title, startDate, endDate, budget ?? 0])
    for (const m of memberIds ?? []) {
      await pool.query('INSERT INTO trip_members (trip_id, member_id) VALUES ($1,$2)', [tripId, m])
    }
    const r = await pool.query('SELECT * FROM trips WHERE id = $1', [tripId])
    res.json(mapTrip(r.rows[0]))
  })

  app.put('/api/trips/:id', async (req, res) => {
    const { title, startDate, endDate, budget } = req.body as { title: string; startDate: string; endDate: string; budget: number }
    await pool.query('UPDATE trips SET title=$1, start_date=$2, end_date=$3, budget=$4 WHERE id=$5',
      [title, startDate, endDate, budget ?? 0, req.params.id])
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
  app.get('/api/places', async (_req, res) => {
    const r = await pool.query('SELECT * FROM places ORDER BY created_at DESC')
    res.json(r.rows.map(mapPlace))
  })

  app.post('/api/places', async (req, res) => {
    const { name, address, category, lat, lng, memo } = req.body as {
      name: string; address: string; category: string; lat?: number | null; lng?: number | null; memo?: string | null
    }
    const placeId = id()
    await pool.query(
      'INSERT INTO places (id, name, address, category, lat, lng, memo) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [placeId, name.trim(), (address ?? '').trim(), category, lat ?? null, lng ?? null, memo ?? null])
    const r = await pool.query('SELECT * FROM places WHERE id = $1', [placeId])
    res.json(mapPlace(r.rows[0]))
  })

  app.put('/api/places/:id', async (req, res) => {
    const { name, address, category, memo } = req.body as { name: string; address: string; category: string; memo: string | null }
    await pool.query('UPDATE places SET name=$1, address=$2, category=$3, memo=$4 WHERE id=$5',
      [name.trim(), (address ?? '').trim(), category, memo, req.params.id])
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
    const placeRow = await pool.query('SELECT * FROM places WHERE id = $1', [placeId])
    if (placeRow.rows.length === 0) { res.status(404).json({ error: '장소를 찾을 수 없어요.' }); return }

    const events = await pool.query(
      `SELECT te.*, t.title AS trip_title FROM timeline_events te
       JOIN trips t ON t.id = te.trip_id
       WHERE te.place_id = $1 ORDER BY t.start_date DESC, te.day_number, te.sequence`, [placeId])

    const visits = []
    for (const ev of events.rows) {
      const photos = await pool.query('SELECT * FROM photos WHERE event_id = $1 ORDER BY created_at', [ev.id])
      visits.push({ ...mapEvent(ev), tripTitle: ev.trip_title, photos: photos.rows.map(mapPhoto) })
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

  // ── 동선(타임라인) ────────────────────────────────────
  async function loadEvents(tripId: string) {
    const events = await pool.query('SELECT * FROM timeline_events WHERE trip_id = $1 ORDER BY day_number, sequence', [tripId])
    const out = []
    for (const ev of events.rows) {
      const place = await pool.query('SELECT * FROM places WHERE id = $1', [ev.place_id])
      const photos = await pool.query('SELECT * FROM photos WHERE event_id = $1 ORDER BY created_at', [ev.id])
      out.push({ ...mapEvent(ev), place: mapPlace(place.rows[0]), photos: photos.rows.map(mapPhoto) })
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
    const { eventId, amount, currency, category, description, paidBy, splitWith, spentAt } = req.body as {
      eventId: string | null; amount: number; currency: string; category: string
      description: string; paidBy: string; splitWith: string[]; spentAt: string
    }
    const expenseId = id()
    await pool.query(
      `INSERT INTO expenses (id, trip_id, event_id, amount, currency, category, description, paid_by, spent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [expenseId, req.params.tripId, eventId, amount, currency, category, description.trim(), paidBy, spentAt])
    for (const m of splitWith ?? []) {
      await pool.query('INSERT INTO expense_splits (expense_id, member_id) VALUES ($1,$2)', [expenseId, m])
    }
    res.json({ ok: true })
  })

  app.delete('/api/expenses/:id', async (req, res) => {
    await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id])
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
      const rel = relativeFilePath(path.join('vouchers', req.params.tripId), f.filename)
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
      const rel = relativeFilePath(path.join('photos', req.params.eventId), f.filename)
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
      const rel = relativeFilePath(path.join('archive', req.params.tripId), f.filename)
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
    res.json(r.rows.map((row) => ({ tripId: row.trip_id, dayNumber: row.day_number, note: row.note, weather: row.weather })))
  })

  app.put('/api/trips/:tripId/day-notes/:dayNumber', async (req, res) => {
    const { note, weather } = req.body as { note: string | null; weather: string | null }
    await pool.query(
      `INSERT INTO day_notes (trip_id, day_number, note, weather) VALUES ($1,$2,$3,$4)
       ON CONFLICT (trip_id, day_number) DO UPDATE SET note = excluded.note, weather = excluded.weather`,
      [req.params.tripId, Number(req.params.dayNumber), note, weather])
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
