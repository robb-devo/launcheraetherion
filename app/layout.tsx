import type { Metadata } from "next"
import { Cinzel, Outfit } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ""

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
})

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Aetherion Launcher",
  description: "Launcher premium para Minecraft — gerenciador de contas, modpacks e runtime Java.",
  generator: "v0.app",
  icons: {
    icon: `${basePath}/icon.svg`,
  },
}

export const viewport = {
  themeColor: "#121018",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} ${cinzel.variable} bg-background dark`}>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
