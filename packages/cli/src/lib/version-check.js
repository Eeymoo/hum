import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import config from './config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const EXIT_VERSION_MISMATCH = 3

export function getCliVersion() {
  try {
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')
    )
    return packageJson.version
  } catch {
    return '0.0.0'
  }
}

export function parseVersion(version) {
  const parts = version.split('.').map(Number)
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  }
}

export async function checkVersion() {
  const cliVersion = getCliVersion()
  const apiUrl = config.get('apiUrl') || 'http://localhost:3000'

  try {
    const response = await fetch(`${apiUrl}/api/v1/health`)
    
    if (!response.ok) {
      console.error('[提示] 无法连接到 API，跳过版本检查。')
      return true
    }

    const data = await response.json()
    const apiVersion = data.version

    if (!apiVersion) {
      console.error('[提示] API 未返回版本信息，跳过版本检查。')
      return true
    }

    const cli = parseVersion(cliVersion)
    const api = parseVersion(apiVersion)

    if (cli.major !== api.major) {
      console.error(`[错误] CLI (v${cliVersion}) 与 API (v${apiVersion}) 主版本不兼容。`)
      console.error('请执行以下命令升级：')
      console.error('  npm install -g hum-cli@latest')
      console.error('或访问：')
      process.exit(EXIT_VERSION_MISMATCH)
    }

    if (cli.minor !== api.minor) {
      console.warn(`[警告] CLI (v${cliVersion}) 与 API (v${apiVersion}) 次版本不一致。`)
      console.warn('建议升级以获得完整功能：npm install -g hum-cli@latest')
      return true
    }

    return true
  } catch (error) {
    console.error('[提示] 无法连接到 API，跳过版本检查。')
    return true
  }
}
