const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin()

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['echarts', 'zrender', 'react-echarts-library'],
  // 启用 instrumentation.ts 支持（Next.js 15 默认启用，此处显式声明以确保兼容）
  experimental: {
    instrumentationHook: true,
  },
}

module.exports = withNextIntl(nextConfig)
