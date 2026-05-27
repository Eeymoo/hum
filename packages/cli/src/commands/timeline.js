import { Command } from 'commander'
import { request } from '../lib/api.js'

const timeline = new Command('timeline')

timeline
  .option('--last <period>', 'Last N days/weeks/months/years (e.g., 7d, 2w, 1m)')
  .option('--start <date>', 'Start date (YYYY-MM-DD)')
  .option('--end <date>', 'End date (YYYY-MM-DD)')
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

      const result = await request(`/timeline?${params.toString()}`)
      console.log(JSON.stringify(result, null, 2))
    } catch (error) {
      console.error('Failed to get timeline:', error.message)
    }
  })

export default timeline
