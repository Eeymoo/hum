import fetch from 'node-fetch'
import { FormData, File } from 'node-fetch'
import { readFileSync } from 'fs'
import config from './config.js'

export async function request(endpoint, options = {}) {
  const apiUrl = config.get('apiUrl') || 'http://localhost:3000'
  const apiKey = config.get('apiKey')

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
    throw new Error(error.message || `HTTP error! status: ${response.status}`)
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

  files.forEach(filePath => {
    const buffer = readFileSync(filePath)
    const fileName = filePath.split('/').pop()
    const file = new File([buffer], fileName)
    formData.append('file', file)
  })

  return formData
}
