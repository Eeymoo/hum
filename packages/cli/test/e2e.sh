#!/bin/bash
set -e

CLI="node $(dirname "$0")/../bin/index.js"
API_URL="http://localhost:3001"
API_KEY="abc123"

echo "=== Hum CLI E2E Test ==="
echo ""

# 1. Config
echo "1. Testing config set..."
$CLI config set apiUrl $API_URL
echo "   ✓ apiUrl set"

# 2. Auth
echo "2. Testing auth login..."
$CLI auth login --api-key $API_KEY
echo "   ✓ logged in"

echo "3. Testing auth status..."
$CLI auth status
echo "   ✓ status ok"

# 3. Record CRUD
echo "4. Testing record add..."
RESULT=$($CLI record add --type custom --data '{"test":true}' --tags e2e --note "auto test" 2>&1)
echo "   $RESULT"
RECORD_ID=$(echo "$RESULT" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}')
if [ -z "$RECORD_ID" ]; then
  echo "   ✗ failed to get record id"
  exit 1
fi
echo "   ✓ record added: $RECORD_ID"

echo "5. Testing record get..."
$CLI record get --id $RECORD_ID > /dev/null
echo "   ✓ record get ok"

echo "6. Testing record list..."
$CLI record list --tag e2e > /dev/null
echo "   ✓ record list ok"

echo "7. Testing record update..."
$CLI record update --id $RECORD_ID --data '{"test":false}' > /dev/null
echo "   ✓ record update ok"

echo "8. Testing record search..."
$CLI record search --query "auto test" > /dev/null
echo "   ✓ record search ok"

echo "9. Testing record delete..."
$CLI record delete --id $RECORD_ID > /dev/null
echo "   ✓ record delete ok"

# 4. Timeline
echo "10. Testing timeline..."
$CLI timeline --last 7d > /dev/null
echo "   ✓ timeline ok"

echo ""
echo "=== All tests passed! ==="
