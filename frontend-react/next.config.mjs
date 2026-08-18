/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // 静态导出：纯 HTML/JS/CSS，服务器无需 Node 进程（省内存）
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
}

export default nextConfig
