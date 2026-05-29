import { Command } from 'commander'
import { request, createFormData } from '../lib/api.js'
import { appendTimezoneOffset, buildQueryParams } from '../lib/timezone.js'
import { outputData } from '../lib/output.js'

const exercise = new Command('exercise')

exercise
  .command('add')
  .requiredOption('--type <type>', 'Exercise type (running/strength/cycling/swimming/other)')
  .requiredOption('--duration <value>', 'Duration in minutes')
  .option('--calories <value>', 'Calories burned')
  .option('--activities <string>', 'Activities in format: "name:prop1=val1,prop2=val2;name2:prop1=val1"')
  .option('--heart-rate-avg <value>', 'Average heart rate')
  .option('--heart-rate-max <value>', 'Max heart rate')
  .option('--feeling <value>', 'Feeling 1-10')
  .option('--extra-data <json>', 'Extra data (JSON string)')
  .option('--location <location>', 'Location')
  .option('--note <note>', 'Note')
  .option('--date <date>', 'Date (YYYY-MM-DD or ISO 8601 datetime)')
  .option('--file <paths...>', 'File paths to attach')
  .action(async (options) => {
    try {
      const formData = createFormData({
        type: options.type,
        duration: options.duration,
        caloriesBurned: options.calories,
        activities: options.activities,
        heartRateAvg: options.heartRateAvg,
        heartRateMax: options.heartRateMax,
        feeling: options.feeling,
        extraData: options.extraData,
        location: options.location,
        note: options.note,
        date: appendTimezoneOffset(options.date)
      }, options.file || [])

      const result = await request('/exercises', {
        method: 'POST',
        body: formData,
        isFormData: true
      })

      console.log('Exercise record added:', result.id)
    } catch (error) {
      console.error('Failed to add exercise record:', error.message)
    }
  })

exercise
  .command('list')
  .option('--type <type>', 'Filter by type')
  .option('--last <period>', 'Last N days/weeks/months/years')
  .option('--start <date>', 'Start date (YYYY-MM-DD)')
  .option('--end <date>', 'End date (YYYY-MM-DD)')
  .option('--page <number>', 'Page number', '1')
  .option('--limit <number>', 'Items per page', '20')
  .option('--include-deleted', 'Include deleted records')
  .option('--format <format>', 'Output format: json, table, toon', 'json')
  .action(async (options) => {
    try {
      const { params, page } = buildQueryParams(options)
      const result = await request(`/exercises?${params.toString()}`)
      outputData(result, { format: options.format, type: 'exercise-list', page })
    } catch (error) {
      console.error('Failed to list exercise records:', error.message)
    }
  })

exercise
  .command('stats')
  .option('--last <period>', 'Last N days/weeks/months/years')
  .option('--start <date>', 'Start date (YYYY-MM-DD)')
  .option('--end <date>', 'End date (YYYY-MM-DD)')
  .option('--format <format>', 'Output format: json, table, toon', 'json')
  .action(async (options) => {
    try {
      const { params } = buildQueryParams(options)
      const result = await request(`/exercises/stats?${params.toString()}`)
      outputData(result, { format: options.format, type: 'exercise-stats' })
    } catch (error) {
      console.error('Failed to get exercise stats:', error.message)
    }
  })

exercise
  .command('get')
  .requiredOption('--id <id>', 'Exercise record ID')
  .option('--format <format>', 'Output format: json, table, toon', 'json')
  .action(async (options) => {
    try {
      const result = await request(`/exercises/${options.id}`)
      outputData(result, { format: options.format, type: 'exercise-get' })
    } catch (error) {
      console.error('Failed to get exercise record:', error.message)
    }
  })

exercise
  .command('update')
  .requiredOption('--id <id>', 'Exercise record ID')
  .option('--type <type>', 'Updated type')
  .option('--duration <value>', 'Updated duration')
  .option('--calories <value>', 'Updated calories burned')
  .option('--activities <string>', 'Updated activities')
  .option('--heart-rate-avg <value>', 'Updated average heart rate')
  .option('--heart-rate-max <value>', 'Updated max heart rate')
  .option('--feeling <value>', 'Updated feeling')
  .option('--extra-data <json>', 'Updated extra data (JSON string)')
  .option('--location <location>', 'Updated location')
  .option('--note <note>', 'Updated note')
  .option('--date <date>', 'Updated date (YYYY-MM-DD or ISO 8601 datetime)')
  .option('--file <paths...>', 'File paths to attach')
  .option('--replace-attachments', 'Replace existing attachments instead of adding')
  .action(async (options) => {
    try {
      const formData = createFormData({
        type: options.type,
        duration: options.duration,
        caloriesBurned: options.calories,
        activities: options.activities,
        heartRateAvg: options.heartRateAvg,
        heartRateMax: options.heartRateMax,
        feeling: options.feeling,
        extraData: options.extraData,
        location: options.location,
        note: options.note,
        date: appendTimezoneOffset(options.date),
        replaceAttachments: options.replaceAttachments ? 'true' : undefined
      }, options.file || [])

      const result = await request(`/exercises/${options.id}`, {
        method: 'PATCH',
        body: formData,
        isFormData: true
      })

      console.log('Exercise record updated:', result.id)
    } catch (error) {
      console.error('Failed to update exercise record:', error.message)
    }
  })

exercise
  .command('delete')
  .requiredOption('--id <id>', 'Exercise record ID')
  .action(async (options) => {
    try {
      await request(`/exercises/${options.id}`, { method: 'DELETE' })
      console.log('Exercise record deleted')
    } catch (error) {
      console.error('Failed to delete exercise record:', error.message)
    }
  })

export default exercise
