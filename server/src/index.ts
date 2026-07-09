import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { initSchema } from './db.js'
import { registerRoutes } from './routes.js'

const app = express()

app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

registerRoutes(app)

const port = Number(process.env.PORT ?? 8787)

initSchema()
  .then(() => {
    app.listen(port, () => console.log(`트래블 온 API 서버 실행 중 → http://localhost:${port}`))
  })
  .catch((err) => {
    console.error('DB 초기화 실패:', err)
    process.exit(1)
  })
