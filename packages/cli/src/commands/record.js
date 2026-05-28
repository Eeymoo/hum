import { Command } from 'commander'
import { request } from '../lib/api.js'
import { appendTimezoneOffset, buildQueryParams } from '../lib/timezone.js'
import { outputData } from '../lib/output.js'

const record = new Command('record')

record
  .command('add')
  .requiredOption('--type <type>', 'Record type (custom|medical|supplement|symptom|other)')
  .requiredOption('--data <json>', 'JSON data for the record')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--note <note>', 'Note for the record')
  .option('--attachments <urls>', 'Comma-separated attachment URLs')
  .option('--date <date>', 'Date (YYYY-MM-DD or ISO 8601 datetime)')
  .action(async (options) => {
    try {
      const recordData = {
        type: options.type,
        data: JSON.parse(options.data),
        tags: options.tags ? options.tags.split(',') : undefined,
        note: options.note,
        attachments: options.attachments ? options.attachments.split(',') : undefined,
        date: appendTimezoneOffset(options.date)
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
  .option('--page <number>', 'Page number', '1')
  .option('--limit <number>', 'Items per page', '20')
  .option('--include-deleted', 'Include deleted records')
  .option('--format <format>', 'Output format: json, table, toon', 'json')
  .action(async (options) => {
    try {
      const { params, page } = buildQueryParams(options)
      const result = await request(`/records?${params.toString()}`)
      outputData(result, { format: options.format, type: 'record-list', page })
    } catch (error) {
      console.error('Failed to list records:', error.message)
    }
  })

record
  .command('get')
  .requiredOption('--id <id>', 'Record ID')
  .option('--include-deleted', 'Include deleted records')
  .option('--format <format>', 'Output format: json, table, toon', 'json')
  .action(async (options) => {
    try {
      const params = new URLSearchParams()
      if (options.includeDeleted) {
        params.append('includeDeleted', 'true')
      }
      const queryString = params.toString()
      const result = await request(`/records/${options.id}${queryString ? '?' + queryString : ''}`)
      outputData(result, { format: options.format, type: 'record-get' })
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
  .option('--date <date>', 'Updated date (YYYY-MM-DD or ISO 8601 datetime)')
  .action(async (options) => {
    try {
      const updateData = {}
      if (options.data) updateData.data = JSON.parse(options.data)
      if (options.tags) updateData.tags = options.tags.split(',')
      if (options.note) updateData.note = options.note
      if (options.attachments) updateData.attachments = options.attachments.split(',')
      if (options.date) updateData.date = appendTimezoneOffset(options.date)

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
  .option('--page <number>', 'Page number', '1')
  .option('--limit <number>', 'Items per page', '20')
  .option('--include-deleted', 'Include deleted records')
  .option('--format <format>', 'Output format: json, table, toon', 'json')
  .action(async (options) => {
    try {
      const { params, page } = buildQueryParams(options)
      params.set('q', options.query)
      const result = await request(`/records/search?${params.toString()}`)
      outputData(result, { format: options.format, type: 'record-list', page })
    } catch (error) {
      console.error('Failed to search records:', error.message)
    }
  })

export default record
