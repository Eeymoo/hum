/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['echarts', 'zrender', 'react-echarts-library'],
}

module.exports = nextConfig
