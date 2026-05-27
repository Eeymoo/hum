import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hum - Health Tracker',
  description: 'Personal health tracking application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
