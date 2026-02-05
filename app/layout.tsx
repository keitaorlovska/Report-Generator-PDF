import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Debate Motion Generator | AI-Powered News-Based Motions",
  description: "Generate compelling debate motions based on recent news and trending topics using AI-powered web search.",
  keywords: ["debate", "motions", "AI", "news", "debate topics", "policy debate"],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}

