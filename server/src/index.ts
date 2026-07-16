import 'dotenv/config'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { initSchema } from './db.js'
import { registerRoutes } from './routes.js'

// 라우트 핸들러 밖(fire-and-forget 콜백 등)에서 발생한 처리 안 된 에러로 프로세스 전체가
// 죽는 것을 막는 최후 방어선. Node 22부터 unhandled rejection은 기본적으로 프로세스를 종료시킨다.
process.on('unhandledRejection', (err) => console.error('처리되지 않은 프로미스 거부:', err))
process.on('uncaughtException', (err) => console.error('처리되지 않은 예외:', err))

const app = express()

app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }))
// JSON 응답 gzip 압축. 파일 스트리밍(/api/files/*)은 이미 압축된 이미지·PDF라 제외
// (압축 시도 자체가 CPU 낭비 + Content-Length 헤더가 사라져 브라우저 진행률 표시가 깨짐).
app.use(compression({
  filter: (req, res) => (req.path.startsWith('/api/files/') ? false : compression.filter(req, res)),
}))
app.use(cookieParser())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

registerRoutes(app)

// 라우트에서 next(err)로 넘긴 에러를 여기서 받아 JSON 500 응답으로 마무리한다.
// (반드시 다른 미들웨어/라우트 등록보다 뒤, 4개 인자 시그니처로 등록해야 Express가 에러 핸들러로 인식함)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('요청 처리 중 오류:', err)
  if (!res.headersSent) res.status(500).json({ error: '서버 오류가 발생했어요.' })
})

const port = Number(process.env.PORT ?? 8787)

initSchema()
  .then(() => {
    app.listen(port, () => console.log(`트래블 온 API 서버 실행 중 → http://localhost:${port}`))
  })
  .catch((err) => {
    console.error('DB 초기화 실패:', err)
    process.exit(1)
  })
