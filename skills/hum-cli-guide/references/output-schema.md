# Output Schema & Analysis

## Record List JSON Structure

`hum record list` returns:

```json
{
  "records": [
    {
      "id": "uuid",
      "type": "weight|exercise|sleep|diet|custom|medical|supplement|symptom|other",
      "data": {},           // type-specific JSON, schema varies by type
      "tags": ["tag1"],
      "note": "string",
      "date": "2024-01-15",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601",
      "deletedAt": null     // soft delete, use --include-deleted to see
    }
  ]
}
```

Common `data` fields by type:
- `weight`: `{ "value": 70.5, "unit": "kg" }`
- `exercise`: `{ "type": "running", "duration": 30, "calories": 300 }`
- `sleep`: `{ "hours": 7.5, "quality": "good" }`
- `diet`: `{ "meal": "lunch", "total_calories": 500, "foods": [...] }`

## Built-in Analysis Commands

Use these instead of manual `jq` when available:

```bash
hum weight timeline --last 30d     # trend + stats
hum exercise summary --last 7d     # aggregated sessions
hum sleep analysis --last 7d       # duration + quality stats
```

**Limitations**: Built-in commands provide pre-computed aggregates. For custom groupings (e.g., by tag, by food type), use `hum record list` + `jq`.

## When to Use Built-in vs Manual

| Task | Use |
|------|-----|
| Weight trend over time | `hum weight timeline` |
| Exercise session count | `hum exercise summary` |
| Sleep quality distribution | `hum sleep analysis` |
| Group by arbitrary tag | `hum record list \| jq` |
| Cross-type correlation | `hum record list \| jq` |
| Custom date range filter | `hum record list \| jq 'select(.date >= ...)'` |

## Useful Flags for Analysis

```bash
hum record list --include-deleted   # include soft-deleted records
hum record list --type weight --last 365d   # full year for trend analysis
```
