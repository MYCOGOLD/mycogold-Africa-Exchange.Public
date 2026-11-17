import type { Metadata, Viewport } from 'next'
import { MarketEconomicsBar } from '../components/MarketEconomicsBar'
import './globals.css'

export const metadata: Metadata = {
  title: 'MYCOGOLD Africa Exchange',
  description: 'A Kenya produce marketplace for listings and non-binding order requests. In-app payments and escrow are not available.',
}
export const viewport: Viewport = { themeColor: '#050505', width: 'device-width', initialScale: 1 }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><MarketEconomicsBar />{children}</body></html>
}
