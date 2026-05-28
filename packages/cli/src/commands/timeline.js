import { Command } from 'commander'
import { request } from '../lib/api.js'
import { buildQueryParams } from '../lib/timezone.js'
import { outputData } from '../lib/output.js'

const timeline = new Command('timeline')

timeline
  .option('--last <period>', 'Last N days/weeks/months/years (e.g., 7d, 2w, 1m)')
  .option('--start <date>', 'Start date (YYYY-MM-DD)')
  .option('--end <date>', 'End date (YYYY-MM-DD)')
  .option('--page <number>', 'Page number', '1')
  .option('--limit <number>', 'Items per page', '20')
  .option('--include-deleted', 'Include deleted records')
  .option('--format <format>', 'Output format: json, table, toon', 'json')
  .action(async (options) => {
    try {
      const { params, page } = buildQueryParams(options)
      const result = await request(`/timeline?${params.toString()}`)
      outputData(result, { format: options.format, type: 'timeline', page })
    } catch (error) {
      console.error('Failed to get timeline:', error.message)
    }
  })

export default timeline
