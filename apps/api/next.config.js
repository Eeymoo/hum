const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin()

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['echarts', 'zrender', 'react-echarts-library'],
}

module.exports = withNextIntl(nextConfig)
