import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import multer from 'multer'

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'data', 'uploads')

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
}

export function makeUploader(subDir: string) {
  const dir = path.join(UPLOAD_DIR, subDir)
  fs.mkdirSync(dir, { recursive: true })
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const name = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${sanitize(file.originalname)}`
      cb(null, name)
    },
  })
  return multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })
}

export function relativeFilePath(subDir: string, filename: string): string {
  return path.posix.join(subDir, filename)
}

export function absoluteFromRelative(relPath: string): string {
  return path.join(UPLOAD_DIR, relPath)
}

export function safeUnlink(relPath: string): void {
  const abs = absoluteFromRelative(relPath)
  if (!abs.startsWith(UPLOAD_DIR)) return
  fs.rm(abs, { force: true }, () => {})
}
