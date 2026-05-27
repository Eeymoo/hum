import { Command } from 'commander'
import { request, createFormData } from '../lib/api.js'

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
  .option('--note <note>', 'Note for the record')
  .option('--date <date>', 'Date for the record (YYYY-MM-DD)')
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
        note: options.note,
        date: options.date
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

      const result = await request(`/weights?${params.toString()}`)
      console.log(JSON.stringify(result, null, 2))
    } catch (error) {
      console.error('Failed to list weight records:', error.message)
    }
  })

weight
  .command('stats')
  .option('--last <period>', 'Last N days/weeks/months/years (e.g., 10, 7d, 2w, 6m, 1y)')
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

      const result = await request(`/weights/stats?${params.toString()}`)
      console.log(JSON.stringify(result, null, 2))
    } catch (error) {
      console.error('Failed to get weight stats:', error.message)
    }
  })

weight
  .command('get')
  .requiredOption('--id <id>', 'Weight record ID')
  .action(async (options) => {
    try {
      const result = await request(`/weights/${options.id}`)
      console.log(JSON.stringify(result, null, 2))
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
  .option('--note <note>', 'Updated note')
  .option('--date <date>', 'Updated date (YYYY-MM-DD)')
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
        note: options.note,
        date: options.date,
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
