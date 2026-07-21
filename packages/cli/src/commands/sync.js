import { Command } from 'commander'
import config from '../lib/config.js'
import { execSync } from 'child_process'

const syncCmd = new Command('sync')

syncCmd
  .description('手动触发数据同步')
  .option('-s, --source <sourceId>', '指定同步源（默认: miapi）', 'miapi')
  .option('--start <date>', '同步起始日期 (YYYY-MM-DD)')
  .option('--end <date>', '同步结束日期 (YYYY-MM-DD)')
  .option('--login', '重新登录获取 Token')
  .option('--status', '查看同步任务历史')
  .action(async (options) => {
    const apiUrl = config.get('apiUrl') || 'http://localhost:3000'
    const apiKey = config.get('apiKey')

    if (!apiKey) {
      console.error('错误：请先运行 hum auth login 登录并配置 API Key')
      process.exit(1)
    }

    // 查看同步历史
    if (options.status) {
      return showSyncStatus(apiUrl, apiKey, options.source)
    }

    // 重新登录
    if (options.login) {
      return doLogin(apiUrl, apiKey, options.source)
    }

    // 执行同步
    return doSync(apiUrl, apiKey, options)
  })

async function showSyncStatus(apiUrl, apiKey, sourceId) {
  try {
    const url = `${apiUrl}/api/v1/sync/jobs?sourceId=${sourceId}&limit=10`
    const resp = execSync(`curl -s -H "Authorization: Bearer ${apiKey}" "${url}"`, {
      encoding: 'utf-8',
      timeout: 10000,
    })
    const data = JSON.parse(resp)

    if (!data.jobs || data.jobs.length === 0) {
      console.log('暂无同步记录')
      return
    }

    console.log('\n同步任务历史:')
    console.log('─'.repeat(80))

    for (const job of data.jobs) {
      const status = {
        success: '✅ 成功',
        failed: '❌ 失败',
        running: '🔄 运行中',
        pending: '⏳ 等待中',
      }[job.status] || job.status

      const time = new Date(job.createdAt).toLocaleString()
      const records = job.result
        ? `运动:${job.result.syncedRecords.exercise} 睡眠:${job.result.syncedRecords.sleep} 体重:${job.result.syncedRecords.weight}`
        : '-'

      console.log(`  [${status}] ${time}`)
      console.log(`    记录: ${records}`)
      if (job.error) {
        console.log(`    错误: ${job.error}`)
      }
      console.log()
    }
  } catch (error) {
    console.error('获取同步状态失败:', error.message)
  }
}

async function doLogin(apiUrl, apiKey, sourceId) {
  console.log(`正在发起 ${sourceId} 登录...`)
  console.log()

  try {
    const url = `${apiUrl}/api/v1/sync/login`
    const resp = execSync(
      `curl -s -X POST -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" -d '{"sourceId":"${sourceId}"}' "${url}"`,
      { encoding: 'utf-8', timeout: 5 * 60 * 1000 },
    )
    const data = JSON.parse(resp)

    if (data.success) {
      console.log('✅ 登录成功！Token 已保存')
    } else {
      console.error('❌ 登录失败:', data.error)
    }
  } catch (error) {
    console.error('登录失败:', error.message)
  }
}

async function doSync(apiUrl, apiKey, options) {
  const body = {
    sourceId: options.source,
  }

  if (options.start) body.startDate = options.start
  if (options.end) body.endDate = options.end

  console.log(`正在同步数据 (source: ${options.source})...`)

  try {
    const url = `${apiUrl}/api/v1/sync/trigger`
    const resp = execSync(
      `curl -s -X POST -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" -d '${JSON.stringify(body)}' "${url}"`,
      { encoding: 'utf-8', timeout: 60 * 1000 },
    )
    const data = JSON.parse(resp)

    if (data.success) {
      const r = data.syncedRecords
      console.log('\n✅ 同步完成！')
      console.log(`  运动记录: ${r.exercise}`)
      console.log(`  睡眠记录: ${r.sleep}`)
      console.log(`  体重记录: ${r.weight}`)
      console.log(`  饮食记录: ${r.diet}`)

      if (data.errors && data.errors.length > 0) {
        console.log('\n部分错误:')
        for (const err of data.errors) {
          console.log(`  ⚠️  ${err.type}: ${err.message}`)
        }
      }
    } else {
      console.error('❌ 同步失败:', data.error)
      process.exit(1)
    }
  } catch (error) {
    console.error('同步请求失败:', error.message)
    process.exit(1)
  }
}

export default syncCmd
