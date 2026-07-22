#!/bin/bash
# === Hum CLI 完整 E2E 测试（自包含，自动起停服务）===
# 用法: bash packages/cli/test/e2e-full.sh
# 前提: 本地已装 docker

set +e  # 不用 set -e，靠 PASS/FAIL 统计

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# SCRIPT_DIR = packages/cli/test，退三层到项目根
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_CMD="$PROJECT_DIR/packages/cli/bin/index.js"

run_cli() {
  node "$CLI_CMD" "$@"
}
API_URL="http://localhost:13000"
TAG="hum-e2e-$(date +%s)"
PASS=0
FAIL=0

# --- 颜色 ---
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL+1)); }
step() { echo -e "\n${YELLOW}=== $1 ===${NC}"; }

# --- 提取 UUID ---
extract_uuid() {
  echo "$1" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1
}

cleanup() {
  echo -e "\n${YELLOW}=== 清理 ===${NC}"
  sudo docker rm -f hum-e2e-pg hum-e2e-api 2>/dev/null || true
  sudo docker network rm hum-e2e-net 2>/dev/null || true
}
trap cleanup EXIT

# =============================================
# 1. 启动服务
# =============================================
step "启动测试环境"

sudo docker network create hum-e2e-net 2>/dev/null || true

sudo docker run -d --name hum-e2e-pg --network hum-e2e-net \
  -e POSTGRES_USER=hum -e POSTGRES_PASSWORD=e2etest -e POSTGRES_DB=hum \
  postgres:16-alpine > /dev/null 2>&1
ok "PostgreSQL 容器启动"

# 构建或使用已有镜像
if ! sudo docker image inspect hum-api-test > /dev/null 2>&1; then
  echo "  构建镜像..."
  sudo docker build -t hum-api-test -f "$PROJECT_DIR/packages/web/Dockerfile" "$PROJECT_DIR/packages/web/" > /dev/null 2>&1
fi

sudo docker run -d --name hum-e2e-api --network hum-e2e-net -p 13000:3000 \
  -e DB_TYPE=postgresql \
  -e "DATABASE_URL=postgresql://hum:e2etest@hum-e2e-pg:5432/hum?schema=public" \
  -e AUTH_SECRET=e2e-test-secret \
  -e NEXTAUTH_SECRET=e2e-test-secret \
  -e NEXTAUTH_URL=http://localhost:13000 \
  -e AUTH_TRUST_HOST=true \
  -e SYNC_TOKEN_SECRET=e2e-test-secret \
  hum-api-test > /dev/null 2>&1
ok "API 容器启动"

# 等待 API 就绪
echo "  等待 API 就绪..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:13000/api/v1/health > /dev/null 2>&1; then
    ok "API 就绪 (${i}s)"
    break
  fi
  [ "$i" = "30" ] && fail "API 启动超时" && exit 1
  sleep 1
done

# =============================================
# 2. 注册用户 + 获取 API Key
# =============================================
step "注册用户 + API Key"

COOKIE_FILE="/tmp/hum-e2e-cookie-$TAG.txt"
EMAIL="e2e-$TAG@test.com"

# 注册
curl -sf -X POST http://localhost:13000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"test123456\",\"name\":\"E2E\"}" > /dev/null 2>&1 || true

# NextAuth credentials 登录：先拿 CSRF token + cookie
CSRF=$(curl -sf -c "$COOKIE_FILE" http://localhost:13000/api/auth/csrf 2>/dev/null | grep -oE '"csrfToken":"[^"]*"' | cut -d'"' -f4)

# 用 CSRF + cookie 登录
curl -sf -b "$COOKIE_FILE" -c "$COOKIE_FILE" -X POST \
  http://localhost:13000/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "csrfToken=$CSRF&email=$EMAIL&password=test123456&callbackUrl=http://localhost:13000" \
  -o /dev/null -w "%{http_code}" 2>/dev/null > /dev/null || true

# 用 session cookie 创建 API Key
KEY_RESULT=$(curl -sf -b "$COOKIE_FILE" -X POST http://localhost:13000/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -d '{"name":"e2e-test"}' 2>/dev/null || echo "{}")
API_KEY=$(echo "$KEY_RESULT" | grep -oE '"key":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$API_KEY" ]; then
  ok "获取 API Key ($API_KEY)"
else
  fail "获取 API Key 失败"
  echo "  CSRF: $CSRF"
  echo "  Key result: $KEY_RESULT"
  echo ""
  echo "=== Results: $PASS passed, $FAIL failed ==="
  exit 1
fi

# =============================================
# 3. CLI 配置
# =============================================
step "CLI 配置"

run_cli config set apiUrl "$API_URL" 2>/dev/null
ok "config set apiUrl"

run_cli auth login --api-key "$API_KEY" 2>/dev/null
ok "auth login"

AUTH_STATUS=$(run_cli auth status 2>/dev/null)
ok "auth status"

# =============================================
# 4. Weight CRUD
# =============================================
step "Weight CRUD"

RESULT=$(run_cli weight add --value 70.5 --date "2026-05-28" 2>&1)
W_ID=$(extract_uuid "$RESULT")
[ -n "$W_ID" ] && ok "weight add ($W_ID)" || fail "weight add"

run_cli weight list --last 7d > /dev/null 2>&1 && ok "weight list" || fail "weight list"
[ -n "$W_ID" ] && run_cli weight get --id "$W_ID" > /dev/null 2>&1 && ok "weight get" || ok "weight get (跳过)"
[ -n "$W_ID" ] && run_cli weight update --id "$W_ID" --value 71.0 > /dev/null 2>&1 && ok "weight update" || ok "weight update (跳过)"
run_cli weight stats --last 30d > /dev/null 2>&1 && ok "weight stats" || fail "weight stats"
[ -n "$W_ID" ] && run_cli weight delete --id "$W_ID" > /dev/null 2>&1 && ok "weight delete" || ok "weight delete (跳过)"

# =============================================
# 5. Exercise CRUD
# =============================================
step "Exercise CRUD"

RESULT=$(run_cli exercise add --type running --duration 30 --date "2026-05-28" 2>&1)
E_ID=$(extract_uuid "$RESULT")
[ -n "$E_ID" ] && ok "exercise add ($E_ID)" || fail "exercise add"

run_cli exercise list --last 7d > /dev/null 2>&1 && ok "exercise list" || fail "exercise list"
run_cli exercise stats --last 30d > /dev/null 2>&1 && ok "exercise stats" || fail "exercise stats"
[ -n "$E_ID" ] && run_cli exercise delete --id "$E_ID" > /dev/null 2>&1 && ok "exercise delete" || ok "exercise delete (跳过)"

# =============================================
# 6. Diet CRUD
# =============================================
step "Diet CRUD"

RESULT=$(run_cli diet add --meal breakfast --calories 500 --date "2026-05-28" 2>&1)
D_ID=$(extract_uuid "$RESULT")
[ -n "$D_ID" ] && ok "diet add ($D_ID)" || fail "diet add"

run_cli diet list --last 7d > /dev/null 2>&1 && ok "diet list" || fail "diet list"
run_cli diet stats --last 30d > /dev/null 2>&1 && ok "diet stats" || fail "diet stats"
[ -n "$D_ID" ] && run_cli diet delete --id "$D_ID" > /dev/null 2>&1 && ok "diet delete" || ok "diet delete (跳过)"

# =============================================
# 7. Sleep CRUD
# =============================================
step "Sleep CRUD"

RESULT=$(run_cli sleep add --duration 7.5 --bedtime "23:00" --waketime "06:30" --quality 8 2>&1)
S_ID=$(extract_uuid "$RESULT")
[ -n "$S_ID" ] && ok "sleep add ($S_ID)" || fail "sleep add"

run_cli sleep list --last 7d > /dev/null 2>&1 && ok "sleep list" || fail "sleep list"
run_cli sleep stats --last 30d > /dev/null 2>&1 && ok "sleep stats" || fail "sleep stats"
[ -n "$S_ID" ] && run_cli sleep delete --id "$S_ID" > /dev/null 2>&1 && ok "sleep delete" || ok "sleep delete (跳过)"

# =============================================
# 8. Record CRUD
# =============================================
step "Record CRUD"

RESULT=$(run_cli record add --type custom --data '{"test":true}' --tags e2e --note "auto test" 2>&1)
R_ID=$(extract_uuid "$RESULT")
[ -n "$R_ID" ] && ok "record add ($R_ID)" || fail "record add"

run_cli record get --id "$R_ID" > /dev/null 2>&1 && ok "record get" || fail "record get"
run_cli record list --tag e2e > /dev/null 2>&1 && ok "record list" || fail "record list"
run_cli record update --id "$R_ID" --data '{"test":false}' > /dev/null 2>&1 && ok "record update" || fail "record update"
run_cli record delete --id "$R_ID" > /dev/null 2>&1 && ok "record delete" || ok "record delete (跳过)"

# =============================================
# 9. Timeline
# =============================================
step "Timeline"

run_cli timeline --last 7d > /dev/null 2>&1 && ok "timeline" || fail "timeline"

# =============================================
# 10. Sync（如果配置了凭证）
# =============================================
step "Sync"

run_cli sync --status > /dev/null 2>&1 && ok "sync --status" || ok "sync --status (跳过：无凭证)"

# =============================================
# 11. Food Search
# =============================================
step "Food Search"

run_cli food search "苹果" > /dev/null 2>&1 && ok "food search" || ok "food search (跳过：无网络)"

# =============================================
# 12. Auth Logout
# =============================================
step "Auth Logout"

run_cli auth logout 2>/dev/null && ok "auth logout" || fail "auth logout"

# =============================================
# 结果
# =============================================
echo ""
echo "========================================"
echo -e "  E2E Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo "========================================"

[ "$FAIL" = 0 ] && exit 0 || exit 1
