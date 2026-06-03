import crypto from 'crypto'

/**
 * RC4 encrypt/decrypt with initial keystream skip.
 */
function _rc4_crypt(key: Uint8Array, data: Uint8Array, skip: number = 1024): Uint8Array {
  const s = Array.from({ length: 256 }, (_, i) => i)
  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 0xFF;
    [s[i], s[j]] = [s[j], s[i]]
  }
  let ii = 0
  j = 0
  for (let _ = 0; _ < skip; _++) {
    ii = (ii + 1) & 0xFF
    j = (j + s[ii]) & 0xFF;
    [s[ii], s[j]] = [s[j], s[ii]]
  }
  const result = new Uint8Array(data.length)
  for (let idx = 0; idx < data.length; idx++) {
    ii = (ii + 1) & 0xFF;
    j = (j + s[ii]) & 0xFF;
    [s[ii], s[j]] = [s[j], s[ii]]
    result[idx] = data[idx] ^ s[(s[ii] + s[j]) & 0xFF]
  }
  return result
}

/**
 * Nonce = base64(random_8_bytes + minutes_since_epoch_4bytes_BE)
 */
function generateNonce(): string {
  const randomPart = crypto.randomBytes(8)
  const minutes = Math.floor(Date.now() / 1000 / 60)
  const timePart = Buffer.alloc(4)
  timePart.writeUInt32BE(minutes, 0)
  return Buffer.concat([randomPart, timePart]).toString('base64')
}

/**
 * signed_nonce = base64(SHA256(b64decode(ssecurity) + b64decode(nonce)))
 */
function computeSignedNonce(ssecurity: string, nonce: string): string {
  const hash = crypto.createHash('sha256')
    .update(Buffer.from(ssecurity, 'base64'))
    .update(Buffer.from(nonce, 'base64'))
    .digest()
  return hash.toString('base64')
}

/**
 * Signature message: METHOD&/path&k1=v1&k2=v2&...&signedNonce_b64
 */
function buildSigMessage(
  method: string,
  urlPath: string,
  params: Record<string, string>,
  signedNonce: string,
): string {
  const parts: string[] = [method.toUpperCase()]
  parts.push(urlPath.startsWith('/') ? urlPath : '/' + urlPath)
  for (const k of Object.keys(params).sort()) {
    parts.push(`${k}=${params[k]}`)
  }
  parts.push(signedNonce)
  return parts.join('&')
}

/**
 * Encrypt multiple values using a single continuous RC4 stream.
 * Values are processed in sorted-key order; each value continues the keystream.
 */
function rc4StreamEncryptValues(
  snonceBytes: Uint8Array,
  sortedEntries: [string, string][],
): Record<string, string> {
  const result: Record<string, string> = {}

  // KSA
  const s = Array.from({ length: 256 }, (_, i) => i)
  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + snonceBytes[i % snonceBytes.length]) & 0xFF;
    [s[i], s[j]] = [s[j], s[i]]
  }

  // Skip 1024 bytes
  let si = 0
  j = 0
  for (let _ = 0; _ < 1024; _++) {
    si = (si + 1) & 0xFF
    j = (j + s[si]) & 0xFF;
    [s[si], s[j]] = [s[j], s[si]]
  }

  // Encrypt each value sequentially using the same stream state
  for (const [key, value] of sortedEntries) {
    const encrypted = new Uint8Array(Buffer.from(value, 'utf-8'))
    for (let idx = 0; idx < encrypted.length; idx++) {
      si = (si + 1) & 0xFF;
      j = (j + s[si]) & 0xFF;
      [s[si], s[j]] = [s[j], s[si]]
      encrypted[idx] = encrypted[idx] ^ s[(s[si] + s[j]) & 0xFF]
    }
    result[key] = Buffer.from(encrypted).toString('base64')
  }

  return result
}

/**
 * SHA1 of the signature message, returned as base64.
 */
function sha1Base64(message: string): string {
  return crypto.createHash('sha1').update(message, 'utf-8').digest('base64')
}

/**
 * MiFitness crypto helper for Xiaomi Health API request signing
 * and response decryption.
 */
export class MiCrypto {
  constructor(private ssecurity: string) {}

  /**
   * Build fully encrypted & signed parameters for an API request.
   *
   * 重要：根据 API 逆向分析，原始参数被包装为 rawTree['data'] = JSON.stringify(params)
   * 而非直接展开为多个 key-value。
   *
   * Steps:
   *  1. Generate nonce, compute signed_nonce
   *  2. Build raw params TreeMap: { data: JSON.stringify(params) }
   *  3. rc4_hash__ = SHA1(sig_message_with_raw_values) → base64
   *  4. Insert rc4_hash__ into params
   *  5. Encrypt all values using continuous RC4 stream (sorted by key)
   *  6. signature = SHA1(sig_message_with_encrypted_values) → base64
   *  7. Return {encrypted params, signature, _nonce}
   */
  buildEncryptedParams(
    method: string,
    urlPath: string,
    params?: Record<string, any>,
  ): { params: Record<string, string>; signature: string; _nonce: string } {
    const nonce = generateNonce()
    const signedNonce = computeSignedNonce(this.ssecurity, nonce)

    // Step 1: 原始参数 TreeMap
    // 关键修复：API 将 params 包装为 data 字段，而非直接展开
    const rawTree: Record<string, string> = {}
    if (params && Object.keys(params).length > 0) {
      rawTree['data'] = JSON.stringify(params)
    }

    // Step 2: 计算 rc4_hash__（基于原始明文参数）
    const rawSigMessage = buildSigMessage(method, urlPath, rawTree, signedNonce)
    rawTree['rc4_hash__'] = sha1Base64(rawSigMessage)

    // Step 3: 用连续 RC4 流加密所有值
    const sortedEntries = Object.entries(rawTree).sort(([a], [b]) => a.localeCompare(b)) as [string, string][]
    const snonceBytes = new Uint8Array(Buffer.from(signedNonce, 'base64'))
    const encryptedParams = rc4StreamEncryptValues(snonceBytes, sortedEntries)

    // Step 4: 计算 signature（基于加密后参数）
    const encSigMessage = buildSigMessage(method, urlPath, encryptedParams, signedNonce)
    const signature = sha1Base64(encSigMessage)

    return { params: encryptedParams, signature, _nonce: nonce }
  }

  /**
   * Decrypt an RC4-encrypted API response body.
   */
  decryptResponse(nonce: string, ciphertext: string): any {
    const signedNonce = computeSignedNonce(this.ssecurity, nonce)
    const key = new Uint8Array(Buffer.from(signedNonce, 'base64'))
    const data = new Uint8Array(Buffer.from(ciphertext, 'base64'))
    const plaintext = _rc4_crypt(key, data)
    return JSON.parse(Buffer.from(plaintext).toString('utf-8'))
  }
}
