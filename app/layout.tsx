import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MYCOGOLD Africa Exchange',
  description: 'A Kenya produce marketplace for seller listings and buyer order requests. Payments and escrow are not enabled.',
}
export const viewport: Viewport = { themeColor: '#050505', width: 'device-width', initialScale: 1 }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html> }
