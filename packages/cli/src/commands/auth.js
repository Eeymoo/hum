import { Command } from 'commander'
import config from '../lib/config.js'
import { request } from '../lib/api.js'
import { getCliVersion } from '../lib/version-check.js'

const auth = new Command('auth')

auth
  .command('login')
  .option('--api-key <key>', 'API key to authenticate with')
  .option('--device', 'Use device code flow')
  .action(async (options) => {
    try {
      if (options.device) {
        const deviceData = await request('/auth/device', { method: 'POST' })
        console.log('Please visit:', deviceData.verificationUriComplete)
        console.log('Code:', deviceData.userCode)
        console.log('Waiting for authorization...')

        const maxAttempts = 60
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise(resolve => setTimeout(resolve, deviceData.interval * 1000))
          try {
            const tokenData = await request('/auth/device/token', {
              method: 'POST',
              body: JSON.stringify({
                deviceCode: deviceData.deviceCode,
                grantType: 'urn:ietf:params:oauth:grant-type:device_code'
              })
            })

            if (tokenData.access_token) {
              config.set('accessToken', tokenData.access_token)
              if (tokenData.refresh_token) {
                config.set('refreshToken', tokenData.refresh_token)
              } else {
                config.delete('refreshToken')
              }
              console.log('Successfully logged in!')
              return
            }
          } catch (err) {
            // authorization_pending 是正常的轮询状态，继续等待
            const msg = err.message || ''
            if (msg.includes('authorization_pending') || msg.includes('not yet authorized')) {
              continue
            }
            // 其他错误（如 expired_token、invalid_grant 等）直接报告
            console.error('Token request error:', msg)
            continue
          }
        }
        console.error('Authorization timeout')
      } else if (options.apiKey || process.env.HUM_API_KEY) {
        const apiKey = options.apiKey || process.env.HUM_API_KEY
        const result = await request('/auth/verify', {
          method: 'POST',
          body: JSON.stringify({ apiKey })
        }).catch(err => {
          // verify 端点在 key 无效时返回 401，捕获后返回统一结构
          if (err.message.includes('401')) {
            return { valid: false }
          }
          throw err
        })

        if (result.valid) {
          config.set('apiKey', apiKey)
          const parts = []
          if (result.user) parts.push(result.user)
          if (result.keyName) parts.push(`key: ${result.keyName}`)
          console.log('Successfully logged in' + (parts.length ? ` as ${parts.join(' / ')}` : '') + '!')
        } else {
          console.error('Invalid API key')
        }
      } else {
        console.error('Please provide --api-key or --device option, or set HUM_API_KEY environment variable')
      }
    } catch (error) {
      console.error('Login failed:', error.message)
    }
  })

auth
  .command('status')
  .action(async () => {
    const apiKey = config.get('apiKey')
    const accessToken = config.get('accessToken')
    const apiUrl = config.get('apiUrl') || 'http://localhost:3000'
    const cliVersion = getCliVersion()

    if (apiKey || accessToken) {
      console.log('Logged in')
      console.log('API URL:', apiUrl)
    } else {
      console.log('Not logged in')
    }

    try {
      const response = await fetch(`${apiUrl}/api/v1/health`)
      if (response.ok) {
        const data = await response.json()
        console.log(`CLI: v${cliVersion} | API: v${data.version}`)
      } else {
        console.log(`CLI: v${cliVersion} | API: unreachable`)
      }
    } catch {
      console.log(`CLI: v${cliVersion} | API: unreachable`)
    }
  })

auth
  .command('logout')
  .action(() => {
    config.delete('apiKey')
    config.delete('accessToken')
    config.delete('refreshToken')
    console.log('Logged out')
  })

auth
  .command('keys')
  .description('Manage API keys')
  .addCommand(new Command('list')
    .action(async () => {
      try {
        const result = await request('/auth/keys')
        console.log(JSON.stringify(result, null, 2))
      } catch (error) {
        console.error('Failed to list keys:', error.message)
      }
    })
  )
  .addCommand(new Command('create')
    .requiredOption('--name <name>', 'Key name')
    .action(async (options) => {
      try {
        const result = await request('/auth/keys', {
          method: 'POST',
          body: JSON.stringify({ name: options.name })
        })
        console.log('API key created:', result.key)
        console.log('Save this key, it will not be shown again.')
      } catch (error) {
        console.error('Failed to create key:', error.message)
      }
    })
  )
  .addCommand(new Command('revoke')
    .requiredOption('--id <id>', 'Key ID')
    .action(async (options) => {
      try {
        await request(`/auth/keys/${options.id}`, { method: 'DELETE' })
        console.log('API key revoked')
      } catch (error) {
        console.error('Failed to revoke key:', error.message)
      }
    })
  )

export default auth
