import crypto from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'

export const SESSION_COOKIE = 'ton_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30일

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET 환경변수가 설정되지 않았어요.')
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

export function makeSessionToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token: unknown): boolean {
  if (typeof token !== 'string') return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(payload)))) return false
  } catch {
    return false
  }
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp: number }
    return typeof exp === 'number' && exp > Date.now()
  } catch {
    return false
  }
}

export function cookieOptions(): { httpOnly: true; secure: boolean; sameSite: 'none' | 'lax'; maxAge: number } {
  const isProd = process.env.NODE_ENV === 'production'
  return { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', maxAge: SESSION_TTL_MS }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE]
  if (!verifySessionToken(token)) {
    res.status(401).json({ error: '로그인이 필요해요.' })
    return
  }
  next()
}
