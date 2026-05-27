---
name: hum-cli-guide
description: Use this skill when the user wants to log, query, update, or manage personal health data (weight, exercise, sleep, diet) via the Hum health-tracking CLI, including authentication setup with API keys or device flow, searching/filtering records, and troubleshooting API errors — even if they don't explicitly mention "Hum" or "CLI".
---

# Hum CLI Guide

This skill helps you use the Hum health tracking CLI effectively.

## When to Use

Use this skill when:
- Setting up Hum CLI for the first time
- Recording health data (weight, exercise, sleep, diet)
- Managing your health records
- Querying your health timeline

## Getting Started

### 1. Check CLI Status

```bash
hum auth status
```

This shows if you're logged in and the API connection status.

### 2. Login

Choose one method:

**Option A: API Key (Recommended for automation)**
```bash
hum auth login --api-key YOUR_API_KEY
```

**Option B: Device Flow (Interactive)**
```bash
hum auth login --device
```

Then visit the URL shown and enter the code.

### 3. Quick Record

Record your first health data:

```bash
# Record weight
hum record add --type weight --data '{"value": 70.5}'

# Record exercise
hum record add --type exercise --data '{"activity": "running", "duration": 30}'

# Record sleep
hum record add --type sleep --data '{"hours": 7.5, "quality": "good"}'
```

## Daily Usage

### View Recent Records

```bash
# List last 7 days
hum record list --last 7d

# Filter by type
hum record list --type weight --last 30d
```

### Update Records

```bash
hum record update --id RECORD_ID --data '{"value": 71.0}'
```

### Search Records

```bash
hum record search --query "running"
```

## References

Load these reference files when the user asks about specific topics:

- **Weight/Exercise/Diet/Sleep commands** → read `references/specialized-commands.md`
- **Configuration or API keys** → read `references/config-and-keys.md`
- **API errors or connection issues** → read `references/troubleshooting.md`
- **Batch operations, tags, file attachments** → read `references/advanced.md`
- **JSON output structure, built-in analysis commands** → read `references/output-schema.md`
