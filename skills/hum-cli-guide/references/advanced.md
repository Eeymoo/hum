# Advanced Usage

## Batch Operations

### Export Records

```bash
# Export to file
hum record list --last 30d > records.json

# Export specific type
hum record list --type weight --last 90d > weight_history.json

# Export date range
hum record list --start 2024-01-01 --end 2024-01-31 > january_data.json

# Include deleted records
hum record list --include-deleted > all_records.json
```

### Bulk Import (via API)

```bash
curl -X POST http://localhost:3000/api/v1/records \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @records.json
```

## Tags

Tags help organize and filter records:

```bash
# Add tags when creating
hum record add --type exercise --data '{"duration": 30}' --tags workout,morning,outdoor

# Filter by tag
hum record list --tag workout --last 7d

# Multiple tags (records matching any)
hum record list --tag workout --tag running --last 7d
```

## File Attachments

Attach files to records:

```bash
# Single file
hum record add --type medical --data '{"type": "blood_test"}' --file report.pdf

# Multiple files
hum record add --type custom --data '{"event": "checkup"}' --file photo1.jpg --file photo2.jpg

# With note
hum record add --type supplement --data '{"name": "vitamin D"}' --file receipt.jpg --note "Purchased at pharmacy"
```

## Time Range Formats

The `--last` flag supports various formats:

```bash
hum record list --last 7d    # Last 7 days
hum record list --last 2w    # Last 2 weeks
hum record list --last 1m    # Last 1 month
hum record list --last 3y    # Last 3 years
hum record list --last 10    # Last 10 records (no suffix)
```

## JSON Data Tips

Use JSON for structured data:

```bash
# Simple values
hum record add --type weight --data '{"value": 70.5}'

# Nested objects
hum record add --type exercise --data '{"running": {"distance": 5, "pace": "5:30"}}'

# Arrays
hum record add --type diet --data '{"foods": ["eggs", "toast", "coffee"]}'

# Complex structure
hum record add --type medical --data '{
  "symptoms": ["headache", "fever"],
  "severity": 7,
  "medication": {"name": "ibuprofen", "dose": "400mg"}
}'
```

## Backdating Records

Use `--date` to record historical data:

```bash
# Record yesterday's weight
hum record add --type weight --data '{"value": 70.5}' --date $(date -d "yesterday" +%Y-%m-%d)

# Record specific date
hum record add --type exercise --data '{"duration": 30}' --date 2024-01-15
```

## Webhook Integration (Self-hosted)

When self-hosting the API, you can POST directly to create records:

```bash
curl -X POST http://localhost:3000/api/v1/records \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "weight",
    "data": {"value": 70.5, "source": "smart-scale"}
  }'
```

Endpoint: `POST /api/v1/records`
Required fields: `type`, `data`
Optional fields: `tags`, `note`, `date`, `attachments`
