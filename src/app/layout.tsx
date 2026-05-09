import type { Metadata } from 'next'
import { Playfair_Display } from 'next/font/google'
import '@/app/globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { DeployTransitionOverlay } from '@/components/deploy-transition-overlay'
import { QueryProvider } from '@/components/query-provider'

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-playfair-display',
})

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
    <html lang="en" className={playfairDisplay.variable} suppressHydrationWarning>
      <body className="font-primary antialiased text-body tracking-normal selection:bg-accent/30 selection:text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <QueryProvider>
            {children}
            <DeployTransitionOverlay />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
