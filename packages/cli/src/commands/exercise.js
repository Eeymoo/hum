import { Command } from 'commander'
import { request, createFormData } from '../lib/api.js'

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
  .option('--location <location>', 'Location')
  .option('--note <note>', 'Note')
  .option('--date <date>', 'Date (YYYY-MM-DD)')
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
        location: options.location,
        note: options.note,
        date: options.date
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

      const result = await request(`/exercises?${params.toString()}`)
      console.log(JSON.stringify(result, null, 2))
    } catch (error) {
      console.error('Failed to list exercise records:', error.message)
    }
  })

exercise
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

      const result = await request(`/exercises/stats?${params.toString()}`)
      console.log(JSON.stringify(result, null, 2))
    } catch (error) {
      console.error('Failed to get exercise stats:', error.message)
    }
  })

exercise
  .command('get')
  .requiredOption('--id <id>', 'Exercise record ID')
  .action(async (options) => {
    try {
      const result = await request(`/exercises/${options.id}`)
      console.log(JSON.stringify(result, null, 2))
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
  .option('--location <location>', 'Updated location')
  .option('--note <note>', 'Updated note')
  .option('--date <date>', 'Updated date (YYYY-MM-DD)')
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
        location: options.location,
        note: options.note,
        date: options.date,
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
