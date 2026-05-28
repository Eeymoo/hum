import { Command } from 'commander'
import { request, createFormData } from '../lib/api.js'
import { appendTimezoneOffset, buildQueryParams } from '../lib/timezone.js'
import { outputData } from '../lib/output.js'

const diet = new Command('diet')

diet
  .command('add')
  .requiredOption('--meal <type>', 'Meal type (breakfast/lunch/dinner/snack)')
  .option('--calories <value>', 'Calories')
  .option('--protein <value>', 'Protein (g)')
  .option('--carbs <value>', 'Carbs (g)')
  .option('--fat <value>', 'Fat (g)')
  .option('--fiber <value>', 'Fiber (g)')
  .option('--sodium <value>', 'Sodium (mg)')
  .option('--foods <string>', 'Foods in format: "name:amount,name2:amount2"')
  .option('--water <value>', 'Water (ml)')
  .option('--note <note>', 'Note')
  .option('--date <date>', 'Date (YYYY-MM-DD or ISO 8601 datetime)')
  .option('--file <paths...>', 'File paths to attach')
  .action(async (options) => {
    try {
      const formData = createFormData({
        mealType: options.meal,
        calories: options.calories,
        protein: options.protein,
        carbs: options.carbs,
        fat: options.fat,
        fiber: options.fiber,
        sodium: options.sodium,
        foods: options.foods,
        water: options.water,
        note: options.note,
        date: appendTimezoneOffset(options.date)
      }, options.file || [])

      const result = await request('/diets', {
        method: 'POST',
        body: formData,
        isFormData: true
      })

      console.log('Diet record added:', result.id)
    } catch (error) {
      console.error('Failed to add diet record:', error.message)
    }
  })

diet
  .command('list')
  .option('--meal <type>', 'Filter by meal type')
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
      const result = await request(`/diets?${params.toString()}`)
      outputData(result, { format: options.format, type: 'diet-list', page })
    } catch (error) {
      console.error('Failed to list diet records:', error.message)
    }
  })

diet
  .command('stats')
  .option('--last <period>', 'Last N days/weeks/months/years')
  .option('--start <date>', 'Start date (YYYY-MM-DD)')
  .option('--end <date>', 'End date (YYYY-MM-DD)')
  .option('--format <format>', 'Output format: json, table, toon', 'json')
  .action(async (options) => {
    try {
      const { params } = buildQueryParams(options)
      const result = await request(`/diets/stats?${params.toString()}`)
      outputData(result, { format: options.format, type: 'diet-stats' })
    } catch (error) {
      console.error('Failed to get diet stats:', error.message)
    }
  })

diet
  .command('get')
  .requiredOption('--id <id>', 'Diet record ID')
  .option('--format <format>', 'Output format: json, table, toon', 'json')
  .action(async (options) => {
    try {
      const result = await request(`/diets/${options.id}`)
      outputData(result, { format: options.format, type: 'diet-get' })
    } catch (error) {
      console.error('Failed to get diet record:', error.message)
    }
  })

diet
  .command('update')
  .requiredOption('--id <id>', 'Diet record ID')
  .option('--meal <type>', 'Updated meal type')
  .option('--calories <value>', 'Updated calories')
  .option('--protein <value>', 'Updated protein')
  .option('--carbs <value>', 'Updated carbs')
  .option('--fat <value>', 'Updated fat')
  .option('--fiber <value>', 'Updated fiber')
  .option('--sodium <value>', 'Updated sodium')
  .option('--foods <string>', 'Updated foods')
  .option('--water <value>', 'Updated water')
  .option('--note <note>', 'Updated note')
  .option('--date <date>', 'Updated date (YYYY-MM-DD or ISO 8601 datetime)')
  .option('--file <paths...>', 'File paths to attach')
  .option('--replace-attachments', 'Replace existing attachments instead of adding')
  .action(async (options) => {
    try {
      const formData = createFormData({
        mealType: options.meal,
        calories: options.calories,
        protein: options.protein,
        carbs: options.carbs,
        fat: options.fat,
        fiber: options.fiber,
        sodium: options.sodium,
        foods: options.foods,
        water: options.water,
        note: options.note,
        date: appendTimezoneOffset(options.date),
        replaceAttachments: options.replaceAttachments ? 'true' : undefined
      }, options.file || [])

      const result = await request(`/diets/${options.id}`, {
        method: 'PATCH',
        body: formData,
        isFormData: true
      })

      console.log('Diet record updated:', result.id)
    } catch (error) {
      console.error('Failed to update diet record:', error.message)
    }
  })

diet
  .command('delete')
  .requiredOption('--id <id>', 'Diet record ID')
  .action(async (options) => {
    try {
      await request(`/diets/${options.id}`, { method: 'DELETE' })
      console.log('Diet record deleted')
    } catch (error) {
      console.error('Failed to delete diet record:', error.message)
    }
  })

export default diet
