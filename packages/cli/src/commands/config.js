import { Command } from 'commander'
import config from '../lib/config.js'

const configCmd = new Command('config')

configCmd
  .command('set')
  .argument('<key>', 'Config key (api-url)')
  .argument('<value>', 'Config value')
  .action((key, value) => {
    const configKey = key === 'api-url' ? 'apiUrl' : key
    config.set(configKey, value)
    console.log(`Set ${key} to ${value}`)
  })

configCmd
  .command('get')
  .argument('<key>', 'Config key (api-url)')
  .action((key) => {
    const configKey = key === 'api-url' ? 'apiUrl' : key
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
      const displayKey = key === 'apiUrl' ? 'api-url' : key
      console.log(`  ${displayKey}: ${value}`)
    }
  })

export default configCmd
