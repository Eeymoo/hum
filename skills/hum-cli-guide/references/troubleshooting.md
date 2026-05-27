# Troubleshooting

## Authentication Issues

**Not logged in?**
```bash
hum auth login --api-key YOUR_KEY
```

**Invalid API key?**
- Check key hasn't been revoked: `hum auth keys list`
- Generate a new key: `hum auth keys create --name "New Key"`

**Device flow timeout?**
- The device code expires after 15 minutes
- Run `hum auth login --device` again to get a new code

## Connection Issues

**API unreachable?**
```bash
# Check status
hum auth status

# Update API URL if self-hosted
hum config set apiUrl http://localhost:3000

# Test connection
curl http://localhost:3000/api/v1/health
```

**SSL certificate errors?**
```bash
# For development only
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Common Errors

**401 Unauthorized**
- API key is missing or invalid
- Key has been revoked
- Check `hum auth status`

**404 Not Found**
- Record ID doesn't exist
- Check `hum record list` for valid IDs

**422 Validation Error**
- Invalid JSON in `--data` flag
- Missing required fields
- Check error message for details

## Getting Help

```bash
# Show help for any command
hum --help
hum record --help
hum record add --help
```
