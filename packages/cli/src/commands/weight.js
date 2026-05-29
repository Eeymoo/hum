import { Command } from 'commander'
import { request, createFormData } from '../lib/api.js'
import { appendTimezoneOffset, buildQueryParams } from '../lib/timezone.js'
import { outputData } from '../lib/output.js'

const weight = new Command('weight')

weight
  .command('add')
  .requiredOption('--value <value>', 'Weight value (kg)')
  .option('--body-fat <value>', 'Body fat percentage')
  .option('--muscle-mass <value>', 'Muscle mass (kg)')
  .option('--bmi <value>', 'BMI')
  .option('--water <value>', 'Water percentage')
  .option('--bone-mass <value>', 'Bone mass (kg)')
  .option('--visceral-fat <value>', 'Visceral fat level')
  .option('--extra-data <json>', 'Extra data (JSON string)')
  .option('--note <note>', 'Note for the record')
  .option('--date <date>', 'Date (YYYY-MM-DD or ISO 8601 datetime)')
  .option('--file <paths...>', 'File paths to attach')
  .action(async (options) => {
    try {
      const formData = createFormData({
        weight: options.value,
        bodyFat: options.bodyFat,
        muscleMass: options.muscleMass,
        bmi: options.bmi,
        water: options.water,
        boneMass: options.boneMass,
        visceralFat: options.visceralFat,
        extraData: options.extraData,
        note: options.note,
        date: appendTimezoneOffset(options.date)
      }, options.file || [])

      const result = await request('/weights', {
        method: 'POST',
        body: formData,
        isFormData: true
      })

      console.log('Weight record added:', result.id)
    } catch (error) {
      console.error('Failed to add weight record:', error.message)
    }
  })

weight
  .command('list')
  .option('--last <period>', 'Last N days/weeks/months/years (e.g., 10, 7d, 2w, 6m, 1y)')
  .option('--start <date>', 'Start date (YYYY-MM-DD)')
  .option('--end <date>', 'End date (YYYY-MM-DD)')
  .option('--page <number>', 'Page number', '1')
  .option('--limit <number>', 'Items per page', '20')
  .option('--include-deleted', 'Include deleted records')
  .option('--format <format>', 'Output format: json, table, toon', 'json')
  .action(async (options) => {
    try {
      const { params, page } = buildQueryParams(options)
      const result = await request(`/weights?${params.toString()}`)
      outputData(result, { format: options.format, type: 'weight-list', page })
    } catch (error) {
      console.error('Failed to list weight records:', error.message)
    }
  })

weight
  .command('stats')
  .option('--last <period>', 'Last N days/weeks/months/years (e.g., 10, 7d, 2w, 6m, 1y)')
  .option('--start <date>', 'Start date (YYYY-MM-DD)')
  .option('--end <date>', 'End date (YYYY-MM-DD)')
  .option('--format <format>', 'Output format: json, table, toon', 'json')
  .action(async (options) => {
    try {
      const { params } = buildQueryParams(options)
      const result = await request(`/weights/stats?${params.toString()}`)
      outputData(result, { format: options.format, type: 'weight-stats' })
    } catch (error) {
      console.error('Failed to get weight stats:', error.message)
    }
  })

weight
  .command('get')
  .requiredOption('--id <id>', 'Weight record ID')
  .option('--format <format>', 'Output format: json, table, toon', 'json')
  .action(async (options) => {
    try {
      const result = await request(`/weights/${options.id}`)
      outputData(result, { format: options.format, type: 'weight-get' })
    } catch (error) {
      console.error('Failed to get weight record:', error.message)
    }
  })

weight
  .command('update')
  .requiredOption('--id <id>', 'Weight record ID')
  .option('--value <value>', 'Updated weight value (kg)')
  .option('--body-fat <value>', 'Updated body fat percentage')
  .option('--muscle-mass <value>', 'Updated muscle mass (kg)')
  .option('--bmi <value>', 'Updated BMI')
  .option('--water <value>', 'Updated water percentage')
  .option('--bone-mass <value>', 'Updated bone mass (kg)')
  .option('--visceral-fat <value>', 'Updated visceral fat level')
  .option('--extra-data <json>', 'Updated extra data (JSON string)')
  .option('--note <note>', 'Updated note')
  .option('--date <date>', 'Updated date (YYYY-MM-DD or ISO 8601 datetime)')
  .option('--file <paths...>', 'File paths to attach')
  .option('--replace-attachments', 'Replace existing attachments instead of adding')
  .action(async (options) => {
    try {
      const formData = createFormData({
        weight: options.value,
        bodyFat: options.bodyFat,
        muscleMass: options.muscleMass,
        bmi: options.bmi,
        water: options.water,
        boneMass: options.boneMass,
        visceralFat: options.visceralFat,
        extraData: options.extraData,
        note: options.note,
        date: appendTimezoneOffset(options.date),
        replaceAttachments: options.replaceAttachments ? 'true' : undefined
      }, options.file || [])

      const result = await request(`/weights/${options.id}`, {
        method: 'PATCH',
        body: formData,
        isFormData: true
      })

      console.log('Weight record updated:', result.id)
    } catch (error) {
      console.error('Failed to update weight record:', error.message)
    }
  })

weight
  .command('delete')
  .requiredOption('--id <id>', 'Weight record ID')
  .action(async (options) => {
    try {
      await request(`/weights/${options.id}`, { method: 'DELETE' })
      console.log('Weight record deleted')
    } catch (error) {
      console.error('Failed to delete weight record:', error.message)
    }
  })

export default weight
