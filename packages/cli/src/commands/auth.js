import { Command } from 'commander'
import config from '../lib/config.js'
import { request } from '../lib/api.js'

const auth = new Command('auth')

auth
  .command('login')
  .requiredOption('--api-key <key>', 'API key to authenticate with')
  .action(async (options) => {
    try {
      const result = await request('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ apiKey: options.apiKey })
      })

      if (result.valid) {
        config.set('apiKey', options.apiKey)
        console.log('Successfully logged in' + (result.name ? ` as ${result.name}` : '') + '!')
      } else {
        console.error('Invalid API key')
      }
    } catch (error) {
      console.error('Login failed:', error.message)
    }
  })

auth
  .command('status')
  .action(() => {
    const apiKey = config.get('apiKey')
    const apiUrl = config.get('apiUrl') || 'http://localhost:3000'
    if (apiKey) {
      console.log('Logged in')
      console.log('API URL:', apiUrl)
    } else {
      console.log('Not logged in')
    }
  })

auth
  .command('logout')
  .action(() => {
    config.delete('apiKey')
    console.log('Logged out')
  })

export default auth
