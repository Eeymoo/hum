---
name: release-tag
description: 在推送 git tag 前，将 apps/api/package.json 和 packages/cli/package.json 的 version 字段同步更新为与 tag 版本号一致。当用户想要发版、打 tag、创建 release、或提到版本号时使用此 skill。
---

# Release Tag

在推送 git tag 之前，自动同步 `apps/api/package.json` 和 `packages/cli/package.json` 的 `version` 字段，使其与目标版本号一致。

## 使用场景

- 用户说"发布版本 X.X.X"
- 用户说"打 tag"、"创建 release"、"推送云端"
- 用户提到要发布新版本

## 执行步骤

### 1. 确认版本号

- 如果用户明确指定了版本号，使用用户指定的版本
- 如果用户未指定，读取 `apps/api/package.json` 的当前 `version` 作为目标版本号
- 向用户确认目标版本号，版本号必须符合 semver 格式

### 2. 检查当前状态

```bash
# 读取当前版本
grep '"version"' apps/api/package.json | head -1
grep '"version"' packages/cli/package.json | head -1

# 检查是否已有同名 tag
git tag -l "vX.X.X"
```

如果目标 tag 已存在，提示用户是否删除旧 tag 并覆盖。

**检查 git 工作区状态：**

在继续发布流程之前，必须确保所有变更已提交。执行：

```bash
git status --porcelain
```

- 如果输出为空，说明工作区干净，继续下一步
- 如果有未提交的变更，**必须先提交**，否则停止发布流程，提示用户：
  - 列出未提交的文件清单
  - 建议用户先提交或暂存变更（`git stash`）
  - 等待用户确认已提交后再继续

### 3. 更新 package.json

同时修改两个文件的 `version` 字段为目标版本号：

- `apps/api/package.json`
- `packages/cli/package.json`

仅修改 `version` 字段，不做其他改动。

### 4. 提交变更

如果 version 字段有变动，提交变更：

```bash
git add apps/api/package.json packages/cli/package.json
git commit -m "更新版本号至 vX.X.X"
```

如果 version 已经与目标一致，跳过此步骤。

### 5. 推送前校验

在推送 tag 之前，**必须**执行构建校验，确保代码不存在类型错误或编译问题，避免推送到远端后 CI 构建失败。

```bash
# 在 apps/api 目录下执行构建（包含类型检查）
cd apps/api && npm run build
```

- 如果构建成功，继续下一步
- 如果构建失败，**停止发布流程**，向用户报告错误信息，提示修复后重试
- 不要跳过此步骤，即使用户要求跳过

### 6. 创建并推送 tag

```bash
git tag vX.X.X
git push origin main --tags
```

## 注意事项

- 确保两个 package.json 的 `version` 值与 tag 名称一致
- tag 格式为 `v` + 版本号，例如 `v0.2.0`
- 先提交 version 变更，再创建 tag，顺序不可颠倒
- 如果 tag 已存在，提示用户是否覆盖
- 如果所有 version 已一致且无需提交，直接创建 tag 并推送
- 发布前必须确保工作区干净，未提交的变更不允许发布
- **推送前必须通过构建校验**，构建失败不允许推送
