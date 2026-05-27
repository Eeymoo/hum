import { Command } from 'commander'
import { request, createFormData } from '../lib/api.js'

const sleep = new Command('sleep')

sleep
  .command('add')
  .requiredOption('--duration <value>', 'Sleep duration in hours')
  .requiredOption('--bedtime <time>', 'Bedtime (HH:mm)')
  .requiredOption('--waketime <time>', 'Wake time (HH:mm)')
  .requiredOption('--quality <value>', 'Sleep quality 1-10')
  .option('--deep-sleep <value>', 'Deep sleep duration in hours')
  .option('--rem-sleep <value>', 'REM sleep duration in hours')
  .option('--awakenings <value>', 'Number of awakenings')
  .option('--feeling <value>', 'Feeling 1-10')
  .option('--note <note>', 'Note')
  .option('--date <date>', 'Date (YYYY-MM-DD)')
  .option('--file <paths...>', 'File paths to attach')
  .action(async (options) => {
    try {
      const formData = createFormData({
        duration: options.duration,
        bedTime: options.bedtime,
        wakeTime: options.waketime,
        quality: options.quality,
        deepSleep: options.deepSleep,
        remSleep: options.remSleep,
        awakenings: options.awakenings,
        feeling: options.feeling,
        note: options.note,
        date: options.date
      }, options.file || [])

      const result = await request('/sleeps', {
        method: 'POST',
        body: formData,
        isFormData: true
      })

      console.log('Sleep record added:', result.id)
    } catch (error) {
      console.error('Failed to add sleep record:', error.message)
    }
  })

sleep
  .command('list')
  .option('--last <period>', 'Last N days/weeks/months/years')
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

      const result = await request(`/sleeps?${params.toString()}`)
      console.log(JSON.stringify(result, null, 2))
    } catch (error) {
      console.error('Failed to list sleep records:', error.message)
    }
  })

sleep
  .command('stats')
  .option('--last <period>', 'Last N days/weeks/months/years')
  .option('--start <date>', 'Start date (YYYY-MM-DD)')
  .option('--end <date>', 'End date (YYYY-MM-DD)')
  .action(async (options) => {
    try {
      const params = new URLSearchParams()
      Object.entries(options).forEach(([key, value]) => {
        if (value) {
          params.append(key, value)
        }
      })

      const result = await request(`/sleeps/stats?${params.toString()}`)
      console.log(JSON.stringify(result, null, 2))
    } catch (error) {
      console.error('Failed to get sleep stats:', error.message)
    }
  })

sleep
  .command('get')
  .requiredOption('--id <id>', 'Sleep record ID')
  .action(async (options) => {
    try {
      const result = await request(`/sleeps/${options.id}`)
      console.log(JSON.stringify(result, null, 2))
    } catch (error) {
      console.error('Failed to get sleep record:', error.message)
    }
  })

sleep
  .command('update')
  .requiredOption('--id <id>', 'Sleep record ID')
  .option('--duration <value>', 'Updated duration')
  .option('--bedtime <time>', 'Updated bedtime')
  .option('--waketime <time>', 'Updated wake time')
  .option('--quality <value>', 'Updated quality')
  .option('--deep-sleep <value>', 'Updated deep sleep')
  .option('--rem-sleep <value>', 'Updated REM sleep')
  .option('--awakenings <value>', 'Updated number of awakenings')
  .option('--feeling <value>', 'Updated feeling')
  .option('--note <note>', 'Updated note')
  .option('--date <date>', 'Updated date (YYYY-MM-DD)')
  .option('--file <paths...>', 'File paths to attach')
  .option('--replace-attachments', 'Replace existing attachments instead of adding')
  .action(async (options) => {
    try {
      const formData = createFormData({
        duration: options.duration,
        bedTime: options.bedtime,
        wakeTime: options.waketime,
        quality: options.quality,
        deepSleep: options.deepSleep,
        remSleep: options.remSleep,
        awakenings: options.awakenings,
        feeling: options.feeling,
        note: options.note,
        date: options.date,
        replaceAttachments: options.replaceAttachments ? 'true' : undefined
      }, options.file || [])

      const result = await request(`/sleeps/${options.id}`, {
        method: 'PATCH',
        body: formData,
        isFormData: true
      })

      console.log('Sleep record updated:', result.id)
    } catch (error) {
      console.error('Failed to update sleep record:', error.message)
    }
  })

sleep
  .command('delete')
  .requiredOption('--id <id>', 'Sleep record ID')
  .action(async (options) => {
    try {
      await request(`/sleeps/${options.id}`, { method: 'DELETE' })
      console.log('Sleep record deleted')
    } catch (error) {
      console.error('Failed to delete sleep record:', error.message)
    }
  })

export default sleep
