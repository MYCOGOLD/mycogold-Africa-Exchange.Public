import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MYCOGOLD Africa Exchange',
  description: 'A live Kenya produce market for verified buyers and sellers.',
}
export const viewport: Viewport = { themeColor: '#050505', width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html> }
