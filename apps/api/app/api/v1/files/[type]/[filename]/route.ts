import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/auth'
import { getUploadPath } from '@/lib/file'
import fs from 'fs/promises'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; filename: string }> }
) {
  const { type, filename } = await params
  const authResult = await verifyApiKey(request.headers.get('authorization'))
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const allowedTypes = ['weights', 'exercises', 'diets', 'sleeps']
    if (!allowedTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
    const filePath = getUploadPath(type, filename)
    const fileBuffer = await fs.readFile(filePath)
    const ext = path.extname(filename).toLowerCase()
    const mimeTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.gpx': 'application/gpx+xml',
      '.fit': 'application/fit',
      '.txt': 'text/plain'
    }
    const mimeType = mimeTypeMap[ext] || 'application/octet-stream'
    return new NextResponse(fileBuffer, {
      headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${filename}"`
    }
  })
  } catch (error) {
    console.error('File GET error:', error)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
