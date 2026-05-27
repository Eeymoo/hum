const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

const dbType = process.env.DB_TYPE || 'sqlite';

// 验证支持的数据库类型
if (!['sqlite', 'postgresql'].includes(dbType)) {
  console.error(`❌ 不支持的数据库类型: ${dbType}，仅支持 sqlite 或 postgresql`);
  process.exit(1);
}

// 替换 provider
content = content.replace(
  /provider\s*=\s*"(sqlite|postgresql|cockroachdb|mysql|sqlserver|mongodb)"/,
  `provider = "${dbType}"`
);

fs.writeFileSync(schemaPath, content);
console.log(`✅ Prisma provider 已切换为: ${dbType}`);

// 切换迁移目录 - 使用复制而不是软链接，避免 Docker 权限问题
const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
const targetMigrationsDir = path.join(__dirname, '..', 'prisma', `migrations_${dbType}`);

if (!fs.existsSync(targetMigrationsDir)) {
  console.error(`❌ 找不到 ${dbType} 的迁移目录: ${targetMigrationsDir}`);
  console.error(`请先为 ${dbType} 创建迁移文件`);
  process.exit(1);
}

// 删除现有的 migrations 目录（如果是软链接或真实目录）
if (fs.existsSync(migrationsDir)) {
  const stat = fs.lstatSync(migrationsDir);
  if (stat.isSymbolicLink()) {
    fs.unlinkSync(migrationsDir);
  } else {
    fs.rmSync(migrationsDir, { recursive: true });
  }
}

// 复制目标迁移目录到 migrations
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(targetMigrationsDir, migrationsDir);
console.log(`✅ 迁移目录已切换为: migrations_${dbType}`);
