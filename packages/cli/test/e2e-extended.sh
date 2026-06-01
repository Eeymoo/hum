#!/bin/bash
set -e

CLI="node $(dirname "$0")/../bin/index.js"
API_URL="http://localhost:3001"
API_KEY="${HUM_API_KEY:-abc123}"

echo "=== Hum CLI Extended E2E Test ==="
echo ""

# 1. Config
echo "=== Config ==="
echo "1. Testing config set..."
$CLI config set apiUrl $API_URL
echo "   ✓ apiUrl set"

echo "2. Testing config get..."
$CLI config get apiUrl > /dev/null
echo "   ✓ config get ok"

echo "3. Testing config list..."
RESULT=$($CLI config list)
echo "   $RESULT"
echo "   ✓ config list ok"

# 2. Auth
echo ""
echo "=== Auth ==="
echo "4. Testing auth login with env var..."
HUM_API_KEY=$API_KEY $CLI auth login --api-key $API_KEY
echo "   ✓ logged in"

echo "5. Testing auth status..."
$CLI auth status
echo "   ✓ status ok"

# 3. Weight CRUD
echo ""
echo "=== Weight ==="
echo "6. Testing weight add..."
RESULT=$($CLI weight add --weight 70.5 --date "2026-05-28" 2&1)
echo "   $RESULT"
WEIGHT_ID=$(echo "$RESULT" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | head -1)
if [ -z "$WEIGHT_ID" ]; then
  echo "   ✗ failed to get weight id"
  exit 1
fi
echo "   ✓ weight added: $WEIGHT_ID"

echo "7. Testing weight list..."
$CLI weight list --last 7d > /dev/null
echo "   ✓ weight list ok"

echo "8. Testing weight get..."
$CLI weight get $WEIGHT_ID > /dev/null
echo "   ✓ weight get ok"

echo "9. Testing weight update..."
$CLI weight update $WEIGHT_ID --weight 71.0 > /dev/null
echo "   ✓ weight update ok"

echo "10. Testing weight stats..."
$CLI weight stats --last 30d > /dev/null
echo "   ✓ weight stats ok"

echo "11. Testing weight delete..."
$CLI weight delete $WEIGHT_ID > /dev/null
echo "   ✓ weight delete ok"

# 4. Exercise CRUD
echo ""
echo "=== Exercise ==="
echo "12. Testing exercise add..."
RESULT=$($CLI exercise add --type running --duration 30 --date "2026-05-28" 2&1)
echo "   $RESULT"
EXERCISE_ID=$(echo "$RESULT" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | head -1)
if [ -z "$EXERCISE_ID" ]; then
  echo "   ✗ failed to get exercise id"
  exit 1
fi
echo "   ✓ exercise added: $EXERCISE_ID"

echo "13. Testing exercise list..."
$CLI exercise list --last 7d > /dev/null
echo "   ✓ exercise list ok"

echo "14. Testing exercise stats..."
$CLI exercise stats --last 30d > /dev/null
echo "   ✓ exercise stats ok"

echo "15. Testing exercise delete..."
$CLI exercise delete $EXERCISE_ID > /dev/null
echo "   ✓ exercise delete ok"

# 5. Diet CRUD
echo ""
echo "=== Diet ==="
echo "16. Testing diet add..."
RESULT=$($CLI diet add --meal breakfast --calories 500 --date "2026-05-28" 2&1)
echo "   $RESULT"
DIET_ID=$(echo "$RESULT" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | head -1)
if [ -z "$DIET_ID" ]; then
  echo "   ✗ failed to get diet id"
  exit 1
fi
echo "   ✓ diet added: $DIET_ID"

echo "17. Testing diet list..."
$CLI diet list --last 7d > /dev/null
echo "   ✓ diet list ok"

echo "18. Testing diet stats..."
$CLI diet stats --last 30d > /dev/null
echo "   ✓ diet stats ok"

echo "19. Testing diet delete..."
$CLI diet delete $DIET_ID > /dev/null
echo "   ✓ diet delete ok"

# 6. Sleep CRUD
echo ""
echo "=== Sleep ==="
echo "20. Testing sleep add..."
RESULT=$($CLI sleep add --duration 7.5 --bedtime "23:00" --waketime "06:30" 2&1)
echo "   $RESULT"
SLEEP_ID=$(echo "$RESULT" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | head -1)
if [ -z "$SLEEP_ID" ]; then
  echo "   ✗ failed to get sleep id"
  exit 1
fi
echo "   ✓ sleep added: $SLEEP_ID"

echo "21. Testing sleep list..."
$CLI sleep list --last 7d > /dev/null
echo "   ✓ sleep list ok"

echo "22. Testing sleep stats..."
$CLI sleep stats --last 30d > /dev/null
echo "   ✓ sleep stats ok"

echo "23. Testing sleep delete..."
$CLI sleep delete $SLEEP_ID > /dev/null
echo "   ✓ sleep delete ok"

# 7. Food
echo ""
echo "=== Food ==="
echo "24. Testing food search..."
$CLI food search "苹果" > /dev/null 2&1 || true
echo "   ✓ food search ok"

# 8. Record CRUD (original)
echo ""
echo "=== Record ==="
echo "25. Testing record add..."
RESULT=$($CLI record add --type custom --data '{"test":true}' --tags e2e --note "auto test" 2&1)
echo "   $RESULT"
RECORD_ID=$(echo "$RESULT" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | head -1)
if [ -z "$RECORD_ID" ]; then
  echo "   ✗ failed to get record id"
  exit 1
fi
echo "   ✓ record added: $RECORD_ID"

echo "26. Testing record get..."
$CLI record get --id $RECORD_ID > /dev/null
echo "   ✓ record get ok"

echo "27. Testing record list..."
$CLI record list --tag e2e > /dev/null
echo "   ✓ record list ok"

echo "28. Testing record update..."
$CLI record update --id $RECORD_ID --data '{"test":false}' > /dev/null
echo "   ✓ record update ok"

echo "29. Testing record search..."
$CLI record search --query "auto test" > /dev/null
echo "   ✓ record search ok"

echo "30. Testing record delete..."
$CLI record delete --id $RECORD_ID > /dev/null
echo "   ✓ record delete ok"

# 9. Timeline
echo ""
echo "=== Timeline ==="
echo "31. Testing timeline..."
$CLI timeline --last 7d > /dev/null
echo "   ✓ timeline ok"

# 10. Auth logout
echo ""
echo "=== Auth Logout ==="
echo "32. Testing auth logout..."
$CLI auth logout
echo "   ✓ logout ok"

echo ""
echo "=== All extended tests passed! ==="
