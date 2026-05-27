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
