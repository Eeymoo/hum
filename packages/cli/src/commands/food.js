import { Command } from 'commander'
import { searchFood } from '../lib/foodSearch.js'
import { outputData } from '../lib/output.js'

const food = new Command('food')

food
  .description('查询食物营养信息')
  .requiredOption('-n, --name <name>', '食物名称（支持模糊匹配）')
  .option('-l, --limit <number>', '返回结果数量上限', '5')
  .option('--no-cache', '跳过本地缓存，重新请求远端')
  .option('--format <format>', '输出格式: json, table, toon', 'json')
  .action(async (options) => {
    try {
      const limit = parseInt(options.limit, 10) || 5
      const { items, degraded } = await searchFood(options.name, {
        limit,
        noCache: options.cache === false
      })

      const cleaned = items.map(({ rawItem, ...rest }) => rest)
      outputData({ foods: cleaned, totalPages: 1, total: cleaned.length }, { format: options.format, type: 'food-list' })
    } catch (error) {
      console.error('查询食物失败:', error.message)
      process.exitCode = 1
    }
  })

export default food
