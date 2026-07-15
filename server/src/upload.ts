import path from 'node:path'
import crypto from 'node:crypto'
import type { Response } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import exifr from 'exifr'
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
})
const BUCKET = process.env.R2_BUCKET_NAME ?? ''

// multer/busboy는 멀티파트 필드를 기본 latin1로 디코딩하므로, 한글 등 비-ASCII 파일명은
// originalname이 깨져서 들어온다. 저장·표시 전에 utf8로 다시 디코딩해줘야 한다.
export function decodeOriginalName(name: string): string {
  return Buffer.from(name, 'latin1').toString('utf8')
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
}

// 로컬 디스크에 안 남기고 메모리에만 올린 뒤 바로 R2로 보낸다 (Railway 컨테이너는 재배포 시
// 디스크가 초기화되므로 파일을 로컬에 두면 안 됨).
export function makeUploader() {
  return multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.avif', '.tiff', '.gif'])

// 사진의 EXIF 촬영일시를 읽는다 (여러 장을 한번에 올릴 때 날짜별로 자동 분류하는 데 사용).
// 원본 버퍼를 읽어야 하므로 압축·업로드(uploadFile) 전에 호출해야 한다.
// EXIF가 없거나 파싱 실패 시 null (fail open — 스크린샷 등 카메라 메타데이터가 없는 이미지도 흔함).
export async function extractTakenDate(file: Express.Multer.File): Promise<Date | null> {
  try {
    const tags = await exifr.parse(file.buffer, { pick: ['DateTimeOriginal', 'CreateDate'] })
    const d = tags?.DateTimeOriginal ?? tags?.CreateDate
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null
  } catch {
    return null
  }
}

// 이미지면 리사이즈·재압축(최대 2000x2000, JPEG 품질 82)해서 용량을 줄인 뒤 R2에 올리고,
// DB에 저장할 오브젝트 키(예: "photos/172..._ab12cd34_name.jpg")를 반환한다.
// 이미지가 아니거나(PDF 등) 압축 중 에러가 나면 원본을 그대로 올린다(fail open).
export async function uploadFile(subDir: string, file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase()
  const base = sanitize(path.basename(file.originalname, path.extname(file.originalname)))
  let body = file.buffer
  let finalExt = ext
  let contentType = file.mimetype

  if (IMAGE_EXTENSIONS.has(ext)) {
    try {
      body = await sharp(file.buffer)
        .rotate()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer()
      finalExt = '.jpg'
      contentType = 'image/jpeg'
    } catch (err) {
      console.error('이미지 압축 실패, 원본 유지:', err)
    }
  }

  const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${base}${finalExt}`
  const key = path.posix.join(subDir, filename)
  await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }))
  return key
}

export async function safeUnlink(key: string | null | undefined): Promise<void> {
  if (!key) return
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
  } catch (err) {
    console.error('R2 파일 삭제 실패:', err)
  }
}

// /api/files/* 라우트에서 호출 — R2 오브젝트를 스트리밍으로 그대로 응답에 흘려보낸다.
// (인증 미들웨어 뒤에 걸려 있어 로그인 세션 없이는 이 라우트 자체가 호출되지 않음)
export async function streamFile(key: string, res: Response): Promise<void> {
  try {
    const obj = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    if (obj.ContentType) res.setHeader('Content-Type', obj.ContentType)
    if (obj.ContentLength != null) res.setHeader('Content-Length', String(obj.ContentLength))
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
    const body = obj.Body as NodeJS.ReadableStream
    body.on('error', () => { if (!res.headersSent) res.status(500); res.end() })
    body.pipe(res)
  } catch (err: any) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) { res.status(404).end(); return }
    throw err
  }
}
