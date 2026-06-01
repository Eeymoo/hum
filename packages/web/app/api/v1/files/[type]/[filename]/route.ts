import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { getUploadPath } from '@/lib/file'
import prisma from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; filename: string }> }
) {
  const { type, filename } = await params
  const authResult = await getAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const allowedTypes = ['weights', 'exercises', 'diets', 'sleeps']
    if (!allowedTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    // 文件归属校验：查询该文件是否属于当前用户的某条记录
    const modelMap: Record<string, string> = {
      weights: 'weight',
      exercises: 'exercise',
      diets: 'diet',
      sleeps: 'sleep',
    }
    const modelName = modelMap[type]
    const records = await (prisma as any)[modelName].findMany({
      where: {
        userId: authResult.userId,
        attachments: { contains: filename },
        deleteAt: 0,
      },
    })

    if (records.length === 0) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 403 })
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
