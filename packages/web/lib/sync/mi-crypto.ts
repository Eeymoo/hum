import crypto from 'crypto'

// ============================================================
// 小米健康数据 API 的 RC4 加密 + SHA1 签名层
//
// 严格依据 miband-bot-api-analysis.md §2.2（实际抓包验证）
// 所有数据 API 请求参数需经此加密，响应需经此解密
// ============================================================

/**
 * RC4 加密/解密（带前 N 字节跳过，防止密钥流弱点）
 * 密钥流跳过 1024 字节后与小米 App 行为一致（RC4-drop[1024]）
 * RC4 对称：加解密同函数
 */
export function rc4Crypt(key: Uint8Array, data: Uint8Array, skip = 1024): Uint8Array {
  // KSA (Key-Scheduling Algorithm)
  const s = Array.from({ length: 256 }, (_, i) => i)
  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + s[i]! + key[i % key.length]!) & 0xff
    const tmp = s[i]!
    s[i] = s[j]!
    s[j] = tmp
  }

  // 跳过前 skip 字节密钥流
  let i = 0
  j = 0
  for (let k = 0; k < skip; k++) {
    i = (i + 1) & 0xff
    j = (j + s[i]!) & 0xff
    const tmp = s[i]!
    s[i] = s[j]!
    s[j] = tmp
  }

  // PRGA + XOR
  const result = new Uint8Array(data.length)
  for (let idx = 0; idx < data.length; idx++) {
    i = (i + 1) & 0xff
    j = (j + s[i]!) & 0xff
    const tmp = s[i]!
    s[i] = s[j]!
    s[j] = tmp
    result[idx] = data[idx]! ^ s[(s[i]! + s[j]!) & 0xff]!
  }
  return result
}

/**
 * 生成请求 nonce
 * 格式: base64(random_8_bytes + minutes_since_epoch_4bytes_BE)
 */
export function generateNonce(): string {
  const randomPart = crypto.randomBytes(8)
  const minutes = Math.floor(Date.now() / 1000 / 60)
  const timePart = Buffer.alloc(4)
  timePart.writeUInt32BE(minutes, 0)
  return Buffer.concat([randomPart, timePart]).toString('base64')
}

/**
 * 计算签名 nonce（用于 RC4 密钥派生）
 * signed_nonce = base64(SHA256(b64decode(ssecurity) + b64decode(nonce)))
 */
export function computeSignedNonce(ssecurity: string, nonce: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(Buffer.from(ssecurity, 'base64'))
    .update(Buffer.from(nonce, 'base64'))
    .digest()
  return hash.toString('base64')
}

/**
 * 构建签名消息字符串（对应 App 中 z94.b 格式）
 * 格式: METHOD&/path&k1=v1&k2=v2&...&signedNonce_b64
 * - method 大写
 * - path 带前导 /
 * - params 按 key 字典序（localeCompare）排序
 */
export function buildSigMessage(
  method: string,
  urlPath: string,
  params: Record<string, string>,
  signedNonce: string,
): string {
  const parts: string[] = [method.toUpperCase()]
  parts.push(urlPath.startsWith('/') ? urlPath : '/' + urlPath)
  for (const k of Object.keys(params).sort((a, b) => a.localeCompare(b))) {
    parts.push(`${k}=${params[k]}`)
  }
  parts.push(signedNonce)
  return parts.join('&')
}

export interface EncryptedParams {
  [key: string]: string
  signature: string
  _nonce: string
}

/**
 * 构建完整的加密请求参数（对应 App 中 ua4.c 方法）
 *
 * 流程:
 * 1. 生成 nonce，计算 signed_nonce = base64(SHA256(ssecurity + nonce))
 * 2. 构建原始参数 TreeMap（data = JSON(params)）
 * 3. rc4_hash__ = SHA1(METHOD&/path&k=v&...&signedNonce) → base64
 * 4. 将 rc4_hash__ 插入 TreeMap
 * 5. 用连续 RC4 流加密所有 TreeMap 值（按 key 字典序，drop 1024）
 * 6. signature = SHA1(METHOD&/path&k=enc_v&...&signedNonce) → base64
 * 7. 返回 {加密后各参数, signature, _nonce}
 */
export function buildEncryptedParams(
  method: string,
  urlPath: string,
  ssecurity: string,
  params?: Record<string, unknown>,
): EncryptedParams {
  const nonce = generateNonce()
  const snonce = computeSignedNonce(ssecurity, nonce)
  const snonceBytes = Buffer.from(snonce, 'base64')

  // Step 1: 原始参数 TreeMap
  const rawTree: Record<string, string> = {}
  if (params) {
    rawTree['data'] = JSON.stringify(params)
  }

  // Step 2: 计算 rc4_hash__（基于原始明文参数）
  const rc4Msg = buildSigMessage(method, urlPath, rawTree, snonce)
  const rc4Hash = crypto.createHash('sha1').update(rc4Msg).digest('base64')

  // Step 3: 插入 rc4_hash__
  rawTree['rc4_hash__'] = rc4Hash

  // Step 4: 用连续 RC4 流加密所有值（按 key 字典序，共用一个密钥流）
  const sortedEntries = Object.entries(rawTree).sort(([a], [b]) => a.localeCompare(b))
  const encryptedValues: Record<string, string> = {}
  // 连续流：所有值顺序加密，密钥流不重置（跨值保持 RC4 状态）
  const rc4State = createRc4State(snonceBytes)
  for (const [k] of sortedEntries) {
    const plainBytes = Buffer.from(rawTree[k]!, 'utf8')
    const encBytes = rc4CryptContinue(rc4State, plainBytes)
    encryptedValues[k] = Buffer.from(encBytes).toString('base64')
  }

  // Step 5: 计算 signature（基于加密后参数）
  const sigMsg = buildSigMessage(method, urlPath, encryptedValues, snonce)
  const signature = crypto.createHash('sha1').update(sigMsg).digest('base64')

  // Step 6: 组装结果
  return {
    ...encryptedValues,
    signature,
    _nonce: nonce,
  }
}

// ── 连续流 RC4（跨多值保持密钥流状态）──────────────────────
// analysis doc：多个值共用一个 RC4 密钥流（skip 1024 后连续推进）
// 上面的 rc4Crypt 是无状态的（每次 KSA+skip），连续流需保留状态

interface Rc4State {
  s: number[]
  i: number
  j: number
}

function createRc4State(key: Uint8Array, skip = 1024): Rc4State {
  const s = Array.from({ length: 256 }, (_, idx) => idx)
  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + s[i]! + key[i % key.length]!) & 0xff
    const tmp = s[i]!
    s[i] = s[j]!
    s[j] = tmp
  }
  let i = 0
  j = 0
  for (let k = 0; k < skip; k++) {
    i = (i + 1) & 0xff
    j = (j + s[i]!) & 0xff
    const tmp = s[i]!
    s[i] = s[j]!
    s[j] = tmp
  }
  return { s, i, j }
}

function rc4CryptContinue(state: Rc4State, data: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length)
  for (let idx = 0; idx < data.length; idx++) {
    state.i = (state.i + 1) & 0xff
    state.j = (state.j + state.s[state.i]!) & 0xff
    const tmp = state.s[state.i]!
    state.s[state.i] = state.s[state.j]!
    state.s[state.j] = tmp
    result[idx] = data[idx]! ^ state.s[(state.s[state.i]! + state.s[state.j]!) & 0xff]!
  }
  return result
}

/**
 * 解密响应：响应用请求时的同一 _nonce 派生 signedNonce，RC4 解密
 * 响应体可能是 base64(RC4(JSON))，也可能带 &&&START&&& 前缀
 */
export function decryptResponse(ssecurity: string, nonce: string, ciphertext: string): unknown {
  let body = ciphertext
  // 剥离 &&&START&&& 前缀
  if (body.startsWith('&&&START&&&')) {
    body = body.slice('&&&START&&&'.length)
  }
  body = body.trim()

  const snonce = computeSignedNonce(ssecurity, nonce)
  const snonceBytes = Buffer.from(snonce, 'base64')
  const cipherBytes = Buffer.from(body, 'base64')
  const plainBytes = rc4Crypt(snonceBytes, cipherBytes)
  const plain = Buffer.from(plainBytes).toString('utf8')
  return JSON.parse(plain)
}
