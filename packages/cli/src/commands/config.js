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
      console.log(`  ${displayKey}: ${value}`)
    }
  })

export default configCmd
