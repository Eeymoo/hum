import { Command } from 'commander'
import config from '../lib/config.js'

const configCmd = new Command('config')

configCmd
  .command('set')
  .argument('<key>', 'Config key (api-url, timezone, dateFormat)')
  .argument('<value>', 'Config value')
  .action((key, value) => {
    const keyMap = {
      'api-url': 'apiUrl',
      'timezone': 'timezone',
      'date-format': 'dateFormat',
      'dateFormat': 'dateFormat'
    }
    const configKey = keyMap[key] || key
    config.set(configKey, value)
    console.log(`Set ${key} to ${value}`)
  })

configCmd
  .command('get')
  .argument('<key>', 'Config key (api-url, timezone, dateFormat)')
  .action((key) => {
    const keyMap = {
      'api-url': 'apiUrl',
      'timezone': 'timezone',
      'date-format': 'dateFormat',
      'dateFormat': 'dateFormat'
    }
    const configKey = keyMap[key] || key
    const value = config.get(configKey)
    if (value !== undefined) {
      console.log(value)
    } else {
      console.log('Not set')
    }
  })

configCmd
  .command('list')
  .action(() => {
    const allConfig = config.store
    console.log('Configuration:')
    for (const [key, value] of Object.entries(allConfig)) {
      const displayKey = key === 'apiUrl' ? 'api-url' : key === 'dateFormat' ? 'date-format' : key
      let displayValue = value
      // 脱敏敏感信息
      if ((key === 'apiKey' || key === 'accessToken' || key === 'refreshToken') && typeof value === 'string' && value.length > 8) {
        displayValue = value.slice(0, 4) + '****' + value.slice(-4)
      }
      console.log(`  ${displayKey}: ${displayValue}`)
    }
  })

export default configCmd
