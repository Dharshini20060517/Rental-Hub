import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { HttpError } from '@/lib/api'

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads'
const MAX_MB = Number(process.env.UPLOAD_MAX_SIZE_MB || 5)
const MAX_BYTES = MAX_MB * 1024 * 1024

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])

export type UploadResult = {
  url: string
  publicId: string
  width?: number
  height?: number
}

/** Parse multipart/form-data from a Request and validate each file. */
export async function parseAndSaveImages(
  req: Request,
  field = 'images',
  maxFiles = 8,
): Promise<UploadResult[]> {
  const form = await req.formData()
  const files = form.getAll(field).filter((f): f is File => f instanceof File)
  if (files.length === 0) {
    throw new HttpError('NO_FILES', 'No files uploaded.', 400)
  }
  if (files.length > maxFiles) {
    throw new HttpError('TOO_MANY', `Too many files (max ${maxFiles}).`, 400)
  }

  const results: UploadResult[] = []
  await fs.mkdir(path.resolve(process.cwd(), UPLOAD_DIR), { recursive: true })

  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      throw new HttpError('BAD_TYPE', `Unsupported file type: ${file.type || 'unknown'}. Allowed: JPEG, PNG, WebP, GIF, AVIF.`, 400)
    }
    if (file.size > MAX_BYTES) {
      throw new HttpError('TOO_LARGE', `File too large (max ${MAX_MB}MB): ${file.name}`, 400)
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5)
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext) ? ext : 'jpg'
    const id = crypto.randomBytes(12).toString('hex')
    const filename = `${id}.${safeExt}`
    const filepath = path.join(path.resolve(process.cwd(), UPLOAD_DIR), filename)
    await fs.writeFile(filepath, buf)

    results.push({
      url: `/uploads/${filename}`,
      publicId: filename,
    })
  }
  return results
}

export async function deleteUpload(publicId: string): Promise<void> {
  if (!publicId || publicId.includes('..') || publicId.includes('/')) return
  const filepath = path.join(path.resolve(process.cwd(), UPLOAD_DIR), publicId)
  try {
    await fs.unlink(filepath)
  } catch {
    /* ignore */
  }
}

/** Save a single file (used for avatars). */
export async function parseAndSaveImage(
  req: Request,
  field = 'avatar',
): Promise<UploadResult> {
  const [res] = await parseAndSaveImages(req, field, 1)
  return res
}
