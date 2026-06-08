#!/bin/bash
set -euo pipefail

# ===== 用户输入 =====
read -p "小米账号 (手机/邮箱/ID): " XIAOMI_USER
read -sp "密码: " XIAOMI_PWD; echo

# ===== 设备指纹生成 =====
DEVICE_ID=$(python3 -c \
  "import hashlib,base64,uuid;print(base64.urlsafe_b64encode(hashlib.sha1(uuid.uuid4().hex.encode()).digest()).decode()[:16])")
echo "[OK] DEVICE_ID=$DEVICE_ID"

# ===== Step 1: 预登录 =====
META=$(curl -s -G "https://account.xiaomi.com/pass/serviceLogin" \
  -d "_json=true" -d "sid=miothealth" -d "_locale=zh_CN" \
  -H "User-Agent: PassportSDK/5.3.0.release.79" \
  -b "deviceId=$DEVICE_ID")

# 小米 API 可能返回 &&&START&&& 前缀，需要去掉
META=$(echo "$META" | sed 's/^&&&START&&&//')

SIGN=$(echo "$META" | jq -r '.sign')
QS=$(echo "$META"   | jq -r '.qs')
CB=$(echo "$META"   | jq -r '.callback')

if [ -z "$SIGN" ] || [ "$SIGN" = "null" ]; then
  echo "[FAIL] Step 1: 未获取到 sign, 响应: $META"; exit 1
fi
echo "[OK] Step 1: sign=${SIGN:0:16}..."

# ===== Step 2: 密码认证 (macOS 用 md5) =====
HASH=$(echo -n "$XIAOMI_PWD" | md5 | tr 'a-z' 'A-Z')

LOGIN=$(curl -s -i -X POST "https://account.xiaomi.com/pass/serviceLoginAuth2" \
  -d "user=$XIAOMI_USER" \
  -d "hash=$HASH" -d "sid=miothealth" -d "_json=true" \
  -d "_sign=$SIGN" -d "qs=$QS" -d "callback=$CB" \
  -H "User-Agent: PassportSDK/5.3.0.release.79" \
  -b "deviceId=$DEVICE_ID")

PASS_TOKEN=$(echo "$LOGIN" | grep -i '^passToken:' | head -1 | cut -d' ' -f2 | tr -d '\r')
USER_ID=$(echo "$LOGIN"    | grep -i '^userId:'    | head -1 | cut -d' ' -f2 | tr -d '\r')

if [ -z "$PASS_TOKEN" ]; then
  echo "[FAIL] Step 2: 未获取到 passToken. 可能需要验证码."
  echo "Response (前 30 行):"; echo "$LOGIN" | head -30; exit 1
fi
echo "[OK] Step 2: PASS_TOKEN=${PASS_TOKEN:0:16}... USER_ID=$USER_ID"

# ===== Step 3a: 获取 STS URL =====
STS_A=$(curl -s -i -G "https://account.xiaomi.com/pass/serviceLogin" \
  -d "_json=true" -d "sid=miothealth" \
  -H "User-Agent: PassportSDK/5.3.0.release.79" \
  -b "userId=$USER_ID; passToken=$PASS_TOKEN; deviceId=$DEVICE_ID")

CUSER_ID=$(echo "$STS_A" | grep -i '^cUserId:' | head -1 | cut -d' ' -f2 | tr -d '\r')
STS_BODY=$(echo "$STS_A" | awk 'BEGIN{RS=""} /^{/{print; exit}')

LOCATION=$(echo  "$STS_BODY" | jq -r '.location')
NONCE=$(echo     "$STS_BODY" | jq -r '.nonce')
SSECURITY=$(echo "$STS_BODY" | jq -r '.ssecurity')

if [ -z "$LOCATION" ] || [ "$LOCATION" = "null" ]; then
  echo "[FAIL] Step 3a: 未获取到 STS URL."; echo "Body: $STS_BODY"; exit 1
fi
echo "[OK] Step 3a: CUSER_ID=$CUSER_ID"

# ===== Step 3b: STS 签名请求 =====
CLIENT_SIGN=$(echo -n "nonce=$NONCE&$SSECURITY" \
  | openssl dgst -sha1 -binary \
  | base64)

STS_B=$(curl -s -i -G "$LOCATION" \
  -d "clientSign=$CLIENT_SIGN" \
  -d "_userIdNeedEncrypt=true" \
  -H "User-Agent: PassportSDK/5.3.0.release.79")

SERVICE_TOKEN=$(echo "$STS_B" \
  | grep -E -i '^miothealth_serviceToken:|^serviceToken:' \
  | head -1 | cut -d' ' -f2 | tr -d '\r' || true)

if [ -z "$SERVICE_TOKEN" ]; then
  echo "[FAIL] Step 3b: 未获取到 serviceToken."; echo "$STS_B" | head -20; exit 1
fi

# ===== 输出全部凭证 =====
echo ""
echo "=========================================="
echo "  将以下值粘贴到页面「手动导入 Token」表单"
echo "=========================================="
echo "  serviceToken:  $SERVICE_TOKEN"
echo "  cUserId:       $CUSER_ID"
echo "  passToken:     $PASS_TOKEN"
echo "  userId:        $USER_ID"
echo "  deviceId:      $DEVICE_ID"
echo "=========================================="
