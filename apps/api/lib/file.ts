import { randomUUID } from 'crypto'
import { writeFile, mkdir, access, unlink } from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const allowedMimeTypes = ['image/', 'application/gpx+xml', 'application/fit', 'text/plain', 'application/pdf']
const allowedExtensions = ['.gpx', '.fit', '.txt', '.pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function ensureUploadDir(type: string) {
  const dir = path.join(UPLOAD_DIR, type)
  try {
    await access(dir)
  } catch {
    await mkdir(dir, { recursive: true })
  }
  return dir
}

export function validateFile(file: { name: string; type: string; size: number }) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large')
  }
  const mimeTypeAllowed = allowedMimeTypes.some(mime => file.type.startsWith(mime))
  const ext = path.extname(file.name).toLowerCase()
  const extensionAllowed = allowedExtensions.includes(ext)
  if (!mimeTypeAllowed && !extensionAllowed) {
    throw new Error('File type not allowed')
  }
}

export async function saveFile(type: string, file: File) {
  const dir = await ensureUploadDir(type)
  const uuid = randomUUID()
  const ext = path.extname(file.name)
  const filename = `${uuid}-${file.name}`
  const filePath = path.join(dir, filename)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)
  return {
    id: `att-${uuid}`,
    filename,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    url: `/api/v1/files/${type}/${filename}`,
    createdAt: new Date().toISOString()
  }
}

export async function deleteFile(type: string, filename: string) {
  const filePath = path.join(UPLOAD_DIR, type, filename)
  try {
    await unlink(filePath)
  } catch (err) {
    console.error(`Failed to delete file ${filename}:`, err)
  }
}

export function getUploadPath(type: string, filename: string) {
  return path.join(UPLOAD_DIR, type, filename)
}
