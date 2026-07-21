# Tasks: xiaomi-data-rc4-encryption

## 1. RC4 加密模块

- [x] 1.1 新建 `packages/web/lib/sync/mi-crypto.ts`：实现 `rc4Crypt`（KSA + skip 1024 + PRGA，严格对齐 analysis doc §2.2.1）
- [x] 1.2 实现 `generateNonce`（base64(8 随机字节 + 4 字节分钟数 BE)）、`computeSignedNonce`（base64(SHA256(ssecurity+nonce))）、`buildSigMessage`（METHOD&/path&k=v&...&signedNonce，字典序）
- [x] 1.3 实现 `buildEncryptedParams`（生成 nonce/signedNonce → 明文参数 TreeMap → rc4_hash__ 插入 → 连续 RC4 流加密多值 → signature）与 `decryptResponse`（用同一 nonce 的 signedNonce RC4 解密响应）

## 2. 改造数据请求

- [x] 2.1 在 `miapi.ts` 新增 `encryptedHealthGet(token, endpoint, params)`：调 `buildEncryptedParams` 生成加密参数 → cookie 认证 fetch → 剥离 `&&&START&&&` → `decryptResponse` → 业务码校验
- [x] 2.2 删除 `healthApiGet`（明文版），4 个数据拉取点（步数/心率/睡眠/体重）改调 `encryptedHealthGet`
- [x] 2.3 确认 401 仍能触发既有 `withRetry` 的 token 刷新逻辑（加密版抛 401 错误格式与明文版一致）

## 3. 测试

- [x] 3.1 `mi-crypto.ts` 单测：RC4 往返（加解密还原）、KSA/skip1024 行为、generateNonce 格式（12 字节 base64）、computeSignedNonce 确定性、buildSigMessage 排序与格式
- [x] 3.2 `buildEncryptedParams` 单测：固定 nonce+ssecurity 产出确定性 signature/rc4_hash__（同输入同输出）、多值连续流加密、rc4_hash__ 基于明文计算
- [x] 3.3 `decryptResponse` 单测：用 `buildEncryptedParams` 加密的参数能被正确解密还原（往返一致性）
- [x] 3.4 关键节点测试覆盖：`extractNonce`（大整数精度修复点）单测、`parseAggValue` 容错、数据映射 fixture 测试（步数/睡眠 segment_details/心率/体重含 >0 过滤）、sourceId 格式、sync 多类型独立失败、ssecurity 缺失检查（+22 测试，共 128 测试全过）

## 4. 真实账号联调

- [x] 4.1 用已绑定凭证（`.tmp/token.json`）拉取数据，验证 RC4 加密被小米接受（✅ 200 + 解密出 code=0 JSON，多次验证：`get_project_data_by_time`/`by_watermark`/`get_max_project_data_watermark` 全部成功）
- [~] 4.2 核对各 dataType 返回的字段结构 — **重大发现**：`get_project_data_by_time` 接口根本不是数据源（实测无数据），真实接口是 `get_aggregated_fitness_data_by_time`（小写 key `steps`/`sleep`/`heart_rate`/`weight`、秒级时间戳、`tag=daily_report`、`result.data_list` 结构、`value` 为 JSON 字符串）。需重写 `sync` 的数据映射
- [x] 4.3 重写 `sync` 方法数据拉取点：4 类聚合（steps/heart_rate/sleep）+ 体重改用原始测量接口 `get_fitness_data_by_time`（含体脂/肌肉/骨量/水分/内脏脂肪）+ 补全 5 类聚合（calories/spo2/valid_stand/intensity/stress）。全量同步 6 个月实测：exercise 696（9类型）+ sleep 100 + weight 20，0 错误，幂等验证通过
- [x] 4.4 发现体重数据在 `get_fitness_data_by_time`（原始测量）而非聚合接口，修正后体重 20 条入库（含 bmi/body_fat_rate/muscle_mass/bone_mass/body_moisture_mass/visceral_fat 等丰富字段）

## 5. 收尾

- [x] 5.1 全量测试通过（web 106 测试 = 93 既有 + 13 个 mi-crypto 新增，无回归）
- [x] 5.2 更新 `docs/api.md` 与 `docs/roadmap.md`：数据同步 RC4 加密层已落地、接口已修正为 `get_aggregated_fitness_data_by_time`、实测入库
- [~] 5.3 与 `land-xiaomi-cloud-sync` 一起统一提升版本号并发布（去掉 alpha 标记）— 待用户确认发版
