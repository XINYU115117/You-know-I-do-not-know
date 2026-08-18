import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: '非常规思考者',
  description:
    '一个帮助普通人理解 AI 的交互体验：AI 不是像人一样思考，而是在大量可能中预测下一步。看它如何把问题拆成信息碎片，再一块一块预测出答案。',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f7f3e8',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
