import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import ForceLocationPermission from "@/components/force-location-permission"

const inter = Inter({ subsets: ["latin"], display: "swap" })

export const metadata = {
  title: "Cuidadores App",
  description: "Aplicación para gestión de cuidadores a domicilio",
  generator: "v0.dev",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <ForceLocationPermission />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
