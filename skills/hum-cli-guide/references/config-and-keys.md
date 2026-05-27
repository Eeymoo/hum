# Configuration and API Key Management

## Configuration

```bash
# View all config
hum config get

# Set API URL (for self-hosted)
hum config set apiUrl http://your-server:3000

# Set default view preferences
hum config set defaultLastPeriod 7d

# List all config keys
hum config list
```

## API Key Management

```bash
# List your API keys
hum auth keys list

# Create new key
hum auth keys create --name "My Laptop"

# Revoke key
hum auth keys revoke --id KEY_ID
```

## Environment Variables

You can also set configuration via environment variables:

```bash
export HUM_API_URL=http://localhost:3000
export HUM_API_KEY=your-key-here
```
