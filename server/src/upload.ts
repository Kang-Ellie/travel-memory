import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import multer from 'multer'
import sharp from 'sharp'

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

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.avif', '.tiff', '.gif'])

// 업로드된 이미지를 리사이즈·재압축해 저장 용량/전송량을 줄인다.
// 지원하지 않는 포맷이거나 처리 중 에러가 나면 원본을 그대로 둔다(fail open).
export async function compressImageInPlace(absPath: string): Promise<string> {
  const ext = path.extname(absPath).toLowerCase()
  if (!IMAGE_EXTENSIONS.has(ext)) return absPath
  try {
    const buffer = await sharp(absPath)
      .rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer()
    const jpgPath = ext === '.jpg' ? absPath : absPath.slice(0, -ext.length) + '.jpg'
    await fs.promises.writeFile(jpgPath, buffer)
    if (jpgPath !== absPath) await fs.promises.unlink(absPath)
    return jpgPath
  } catch (err) {
    console.error('이미지 압축 실패, 원본 유지:', err)
    return absPath
  }
}
