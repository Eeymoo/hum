import { readFileSync } from 'fs'
import config from './config.js'

function yellowWarn(message) {
  // \x1b[33m 是黄色，\x1b[0m 是重置
  console.warn('\x1b[33m%s\x1b[0m', message)
}

export async function request(endpoint, options = {}) {
  const apiUrl = config.get('apiUrl') || 'http://localhost:3000'
  const apiKey = config.get('apiKey')

  if (apiUrl === 'http://localhost:3000') {
    yellowWarn('Warning: Using local API (http://localhost:3000). Ensure this is intended.')
  }

  const url = `${apiUrl}/api/v1${endpoint}`
  const headers = {
    ...options.headers
  }

  if (!options.isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const response = await fetch(url, {
    ...options,
    headers
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `请求失败，状态码: ${response.status}`)
  }

  return response.json()
}

export function createFormData(fields, files = []) {
  const formData = new FormData()

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value.toString())
    }
  })

  const mimeMap = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.gpx': 'application/gpx+xml',
    '.fit': 'application/fit'
  }

  files.forEach(filePath => {
    const buffer = readFileSync(filePath)
    const fileName = filePath.split('/').pop()
    const ext = '.' + fileName.split('.').pop().toLowerCase()
    const type = mimeMap[ext] || 'application/octet-stream'
    const file = new File([buffer], fileName, { type })
    formData.append('file', file)
  })

  return formData
}
