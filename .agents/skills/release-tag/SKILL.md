---
name: release-tag
description: 在推送 git tag 前，将 apps/api/package.json 的 version 字段更新为与 tag 版本号一致。当用户想要发版、打 tag、创建 release、或提到版本号时使用此 skill。
---

# Release Tag

在推送创建 git tag 之前，自动更新 `apps/api/package.json` 的 `version` 字段，使其与目标版本号一致。

## 使用场景

- 用户说"发布版本 X.X.X"
- 用户说"打 tag"、"创建 release"
- 用户提到要发布新版本

## 执行步骤

### 1. 确认版本号

向用户确认目标版本号（如 `0.2.0`），版本号必须符合 semver 格式。

### 2. 更新 package.json

修改 `apps/api/package.json` 中的 `version` 字段为目标版本号：

- 文件路径：`apps/api/package.json`
- 仅修改 `version` 字段，不做其他改动

### 3. 提交变更

使用以下命令提交版本变更：

```bash
git add apps/api/package.json
git commit -m "更新版本号至 vX.X.X"
```

### 4. 创建并推送 tag

```bash
git tag vX.X.X
git push origin main --tags
```

## 注意事项

- 确保 `apps/api/package.json` 的 `version` 值与 tag 名称一致
- tag 格式为 `v` + 版本号，例如 `v0.2.0`
- 先提交 version 变更，再创建 tag，顺序不可颠倒
- 如果 tag 已存在，提示用户是否覆盖
