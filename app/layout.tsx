import type { Metadata, Viewport } from 'next'
import { MarketEconomicsBar } from '../components/MarketEconomicsBar'
import './globals.css'

export const metadata: Metadata = {
  title: 'MYCOGOLD Africa Exchange',
  description: 'A Kenya produce marketplace with M-Pesa STK checkout and delivery-verified escrow.',
}
export const viewport: Viewport = { themeColor: '#050505', width: 'device-width', initialScale: 1 }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><MarketEconomicsBar />{children}</body></html>
}
