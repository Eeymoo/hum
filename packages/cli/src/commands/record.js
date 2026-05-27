import { Command } from 'commander'
import { request } from '../lib/api.js'

const record = new Command('record')

record
  .command('add')
  .requiredOption('--type <type>', 'Record type (custom|medical|supplement|symptom|other)')
  .requiredOption('--data <json>', 'JSON data for the record')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--note <note>', 'Note for the record')
  .option('--attachments <urls>', 'Comma-separated attachment URLs')
  .option('--date <date>', 'Date for the record (YYYY-MM-DD)')
  .action(async (options) => {
    try {
      const recordData = {
        type: options.type,
        data: JSON.parse(options.data),
        tags: options.tags ? options.tags.split(',') : undefined,
        note: options.note,
        attachments: options.attachments ? options.attachments.split(',') : undefined,
        date: options.date
      }

      const result = await request('/records', {
        method: 'POST',
        body: JSON.stringify(recordData)
      })

      console.log('Record added:', result.id)
    } catch (error) {
      console.error('Failed to add record:', error.message)
    }
  })

record
  .command('list')
  .option('--type <type>', 'Filter by type')
  .option('--tag <tag>', 'Filter by tag')
  .option('--last <period>', 'Last N days/weeks/months/years (e.g., 10, 7d, 2w, 6m, 1y)')
  .option('--start <date>', 'Start date (YYYY-MM-DD)')
  .option('--end <date>', 'End date (YYYY-MM-DD)')
  .option('--date <date>', 'Specific date (YYYY-MM-DD)')
  .option('--include-deleted', 'Include deleted records')
  .action(async (options) => {
    try {
      const params = new URLSearchParams()
      Object.entries(options).forEach(([key, value]) => {
        if (value) {
          const paramKey = key === 'includeDeleted' ? 'includeDeleted' : key
          params.append(paramKey, value === true ? 'true' : value)
        }
      })

      const result = await request(`/records?${params.toString()}`)
      console.log(JSON.stringify(result, null, 2))
    } catch (error) {
      console.error('Failed to list records:', error.message)
    }
  })

record
  .command('get')
  .requiredOption('--id <id>', 'Record ID')
  .option('--include-deleted', 'Include deleted records')
  .action(async (options) => {
    try {
      const params = new URLSearchParams()
      if (options.includeDeleted) {
        params.append('includeDeleted', 'true')
      }
      const queryString = params.toString()
      const result = await request(`/records/${options.id}${queryString ? '?' + queryString : ''}`)
      console.log(JSON.stringify(result, null, 2))
    } catch (error) {
      console.error('Failed to get record:', error.message)
    }
  })

record
  .command('update')
  .requiredOption('--id <id>', 'Record ID')
  .option('--data <json>', 'Updated JSON data')
  .option('--tags <tags>', 'Updated comma-separated tags')
  .option('--note <note>', 'Updated note')
  .option('--attachments <urls>', 'Updated comma-separated attachment URLs')
  .option('--date <date>', 'Updated date (YYYY-MM-DD)')
  .action(async (options) => {
    try {
      const updateData = {}
      if (options.data) updateData.data = JSON.parse(options.data)
      if (options.tags) updateData.tags = options.tags.split(',')
      if (options.note) updateData.note = options.note
      if (options.attachments) updateData.attachments = options.attachments.split(',')
      if (options.date) updateData.date = options.date

      const result = await request(`/records/${options.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      })

      console.log('Record updated:', result.id)
    } catch (error) {
      console.error('Failed to update record:', error.message)
    }
  })

record
  .command('delete')
  .requiredOption('--id <id>', 'Record ID')
  .action(async (options) => {
    try {
      await request(`/records/${options.id}`, {
        method: 'DELETE'
      })

      console.log('Record deleted')
    } catch (error) {
      console.error('Failed to delete record:', error.message)
    }
  })

record
  .command('search')
  .requiredOption('--query <text>', 'Search query')
  .option('--type <type>', 'Filter by type')
  .option('--last <period>', 'Last N days/weeks/months/years')
  .option('--include-deleted', 'Include deleted records')
  .action(async (options) => {
    try {
      const params = new URLSearchParams()
      params.append('q', options.query)
      if (options.type) params.append('type', options.type)
      if (options.last) params.append('last', options.last)
      if (options.includeDeleted) params.append('includeDeleted', 'true')

      const result = await request(`/records/search?${params.toString()}`)
      console.log(JSON.stringify(result, null, 2))
    } catch (error) {
      console.error('Failed to search records:', error.message)
    }
  })

export default record
