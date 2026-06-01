import { Command } from 'commander'
import { request, createFormData } from './api.js'
import { appendTimezoneOffset, buildQueryParams } from './timezone.js'
import { outputData } from './output.js'

/**
 * Create a CRUD command with add/list/get/update/delete/stats subcommands.
 *
 * @param {string} name - Command name (e.g. 'diet', 'exercise')
 * @param {object} options
 * @param {string} options.endpoint - API endpoint prefix (e.g. '/diets')
 * @param {Array<{flag: string, description: string, formKey?: string, required?: boolean}>} options.fields
 *   CLI flags for add/update. `formKey` maps to the FormData field name; defaults to camelCase of flag.
 * @param {string[]} [options.fileFields] - Flags that accept file paths (e.g. ['file'])
 * @param {Function} [options.statsFormatter] - Optional formatter for stats output type (e.g. () => 'diet-stats')
 * @param {Function} [options.beforeAdd] - Hook to mutate fields before add request
 * @param {Function} [options.beforeUpdate] - Hook to mutate fields before update request
 */
export function createCrudCommand(name, options) {
  const { endpoint, fields = [], fileFields = [], statsFormatter, beforeAdd, beforeUpdate } = options
  const cmd = new Command(name)

  const toCamel = (str) =>
    str.replace(/^-+/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())

  const buildFormData = (opts) => {
    const data = {}
    for (const f of fields) {
      const key = f.formKey || toCamel(f.flag)
      const val = opts[toCamel(f.flag)]
      if (val !== undefined && val !== null) {
        data[key] = val
      }
    }
    if (opts.date) {
      data.date = appendTimezoneOffset(opts.date)
    }
    if (opts.replaceAttachments) {
      data.replaceAttachments = 'true'
    }
    const files = []
    for (const ff of fileFields) {
      const val = opts[toCamel(ff)]
      if (val && val.length > 0) {
        files.push(...val)
      }
    }
    return createFormData(data, files)
  }

  // add
  const addCmd = cmd.command('add')
  for (const f of fields) {
    const method = f.required ? 'requiredOption' : 'option'
    addCmd[method](`--${f.flag} <value>`, f.description)
  }
  for (const ff of fileFields) {
    addCmd.option(`--${ff} <paths...>`, 'File paths to attach')
  }
  addCmd
    .option('--date <date>', 'Date (YYYY-MM-DD or ISO 8601 datetime)')
    .action(async (opts) => {
      try {
        let formData = buildFormData(opts)
        if (beforeAdd) {
          const override = beforeAdd(opts)
          if (override) {
            formData = createFormData(override, opts.file || [])
          }
        }
        const result = await request(endpoint, {
          method: 'POST',
          body: formData,
          isFormData: true
        })
        console.log(`${name} record added:`, result.id)
      } catch (error) {
        console.error(`添加${name}记录失败:`, error.message)
        process.exitCode = 1
      }
    })

  // list
  cmd
    .command('list')
    .option('--last <period>', 'Last N days/weeks/months/years')
    .option('--start <date>', 'Start date (YYYY-MM-DD)')
    .option('--end <date>', 'End date (YYYY-MM-DD)')
    .option('--page <number>', 'Page number', '1')
    .option('--limit <number>', 'Items per page', '20')
    .option('--include-deleted', 'Include deleted records')
    .option('--format <format>', 'Output format: json, table, toon', 'json')
    .action(async (opts) => {
      try {
        const { params, page } = buildQueryParams(opts)
        const result = await request(`${endpoint}?${params.toString()}`)
        outputData(result, { format: opts.format, type: `${name}-list`, page })
      } catch (error) {
        console.error(`获取${name}列表失败:`, error.message)
        process.exitCode = 1
      }
    })

  // stats
  cmd
    .command('stats')
    .option('--last <period>', 'Last N days/weeks/months/years')
    .option('--start <date>', 'Start date (YYYY-MM-DD)')
    .option('--end <date>', 'End date (YYYY-MM-DD)')
    .option('--format <format>', 'Output format: json, table, toon', 'json')
    .action(async (opts) => {
      try {
        const { params } = buildQueryParams(opts)
        const result = await request(`${endpoint}/stats?${params.toString()}`)
        const type = statsFormatter ? statsFormatter() : `${name}-stats`
        outputData(result, { format: opts.format, type })
      } catch (error) {
        console.error(`获取${name}统计失败:`, error.message)
        process.exitCode = 1
      }
    })

  // get
  cmd
    .command('get')
    .requiredOption('--id <id>', `${name} record ID`)
    .option('--format <format>', 'Output format: json, table, toon', 'json')
    .action(async (opts) => {
      try {
        const result = await request(`${endpoint}/${opts.id}`)
        outputData(result, { format: opts.format, type: `${name}-get` })
      } catch (error) {
        console.error(`获取${name}记录失败:`, error.message)
        process.exitCode = 1
      }
    })

  // update
  const updateCmd = cmd.command('update')
  updateCmd.requiredOption('--id <id>', `${name} record ID`)
  for (const f of fields) {
    updateCmd.option(`--${f.flag} <value>`, `Updated ${f.description.toLowerCase()}`)
  }
  for (const ff of fileFields) {
    updateCmd.option(`--${ff} <paths...>`, 'File paths to attach')
  }
  updateCmd
    .option('--date <date>', 'Updated date (YYYY-MM-DD or ISO 8601 datetime)')
    .option('--replace-attachments', 'Replace existing attachments instead of adding')
    .action(async (opts) => {
      try {
        let formData = buildFormData(opts)
        if (beforeUpdate) {
          const override = beforeUpdate(opts)
          if (override) {
            formData = createFormData(override, opts.file || [])
          }
        }
        const result = await request(`${endpoint}/${opts.id}`, {
          method: 'PATCH',
          body: formData,
          isFormData: true
        })
        console.log(`${name} record updated:`, result.id)
      } catch (error) {
        console.error(`更新${name}记录失败:`, error.message)
        process.exitCode = 1
      }
    })

  // delete
  cmd
    .command('delete')
    .requiredOption('--id <id>', `${name} record ID`)
    .action(async (opts) => {
      try {
        await request(`${endpoint}/${opts.id}`, { method: 'DELETE' })
        console.log(`${name} record deleted`)
      } catch (error) {
        console.error(`删除${name}记录失败:`, error.message)
        process.exitCode = 1
      }
    })

  return cmd
}
