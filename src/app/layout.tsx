import type { Metadata } from 'next'
import '@/app/globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { DeployTransitionOverlay } from '@/components/deploy-transition-overlay'

export const metadata: Metadata = {
  title: 'Dream Land Reality | AI Architecture Suite',
  description: 'Admin Portal for Dream Land Reality Property System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Playfair+Display:ital,wght@0,400..700;1,400..700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased text-body tracking-normal selection:bg-accent/30 selection:text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <DeployTransitionOverlay />
        </ThemeProvider>
      </body>
    </html>
  )
}
