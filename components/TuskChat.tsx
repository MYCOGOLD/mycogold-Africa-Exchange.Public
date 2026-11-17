'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Bot, Send } from 'lucide-react'
import type { Listing } from './types'
import { MarketIntelligence } from './MarketIntelligence'

type Message = { role: 'user' | 'assistant'; text: string }

const normalize = (value: string | null | undefined) => (value || '').trim().toLocaleLowerCase()
const medianOf = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function answerFromListings(question: string, listings: Listing[]) {
  const q = normalize(question)
  if (q.includes('mfpi') || q.includes('market index')) {
    return 'The verified trade-based MFPI is unpublished because there are not enough verified trade records. I can compare seller asking prices, but those are not completed transaction prices.'
  }
  if (/\b(buy|sell|safe|scam|pay|payment|escrow)\b/.test(q)) {
    return 'Treat these results as a starting point. Confirm the price unit, grade, quantity, seller identity, stock and delivery terms directly. This app does not collect payment or provide escrow; do not send money based on this chat.'
  }

  const productNames = [...new Set(listings.map(row => (row.product || row.category || '').trim()).filter(Boolean))]
  const matchingNames = productNames.filter(name => q.includes(normalize(name)))
  const locationNames = [...new Set(listings.map(row => row.location?.trim()).filter((value): value is string => Boolean(value)))].filter(name => q.includes(normalize(name)))
  let matches = listings
  if (matchingNames.length) matches = matches.filter(row => normalize(row.product || row.category) === normalize(matchingNames[0]))
  if (locationNames.length) matches = matches.filter(row => normalize(row.location) === normalize(locationNames[0]))
  if (!matchingNames.length && !locationNames.length) {
    return `I can analyze the listings loaded in this market. Available products include ${productNames.slice(0, 6).join(', ') || 'none yet'}. Ask about one of these products or a location.`
  }

  const prices = matches.map(row => Number(row.price)).filter(value => Number.isFinite(value) && value > 0)
  const label = matchingNames[0] || locationNames[0]
  if (!prices.length) return `I found ${matches.length} matching ${label} listing${matches.length === 1 ? '' : 's'}, but none has a usable asking price.`

  const median = medianOf(prices)
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  const candidates = matches.filter(row => Number(row.price) > 0).sort((a, b) => Number(a.price) - Number(b.price)).slice(0, 3)
  const sample = prices.length < 3 ? 'Evidence is limited.' : `${prices.length} asking prices are in this comparison.`
  const options = candidates.map(row => `${row.seller || 'Seller'} in ${row.location || 'unspecified location'}: KES ${Number(row.price).toLocaleString()}${row.quantity ? `, quantity ${row.quantity}` : ''}`).join('; ')
  return `${label}${locationNames.length ? ` in ${locationNames[0]}` : ''}: median asking price KES ${median.toLocaleString(undefined, { maximumFractionDigits: 2 })}; observed range KES ${low.toLocaleString()}–${high.toLocaleString()}. ${sample} Examples: ${options}. Price units and grade may differ, so verify comparability before using this as a benchmark.`
}

export function TuskChat({ listings }: { listings: Listing[] }) {
  const products = useMemo(() => [...new Set(listings.map(row => (row.product || row.category || '').trim()).filter(Boolean))], [listings])
  const starters = products.slice(0, 3).map(product => `Compare ${product}`)
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: 'I can analyze the marketplace listings currently loaded. I explain what the data supports and call out what is unknown. I am not connected to an external AI model or verified market feed.' }])
  const [input, setInput] = useState('')

  function send(value = input) {
    const question = value.trim()
    if (!question) return
    setInput('')
    setMessages(current => [...current, { role: 'user', text: question }, { role: 'assistant', text: answerFromListings(question, listings) }])
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    send()
  }

  return <div className="space-y-4">
    <MarketIntelligence listings={listings}/>
    <section className="glass p-4" aria-label="Ask TUSK about the marketplace">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {(starters.length ? starters : ['What is MFPI?', 'How do I compare prices?', 'How do I trade safely?']).map(prompt => <button className="ghost-btn shrink-0" key={prompt} onClick={() => send(prompt)}>{prompt}</button>)}
      </div>
      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto" aria-live="polite">
        {messages.map((message, index) => <div className={message.role === 'user' ? 'ml-8 rounded-xl bg-[#ffd60a] p-3 text-sm text-black' : 'mr-8 rounded-xl bg-white/[.05] p-3 text-sm'} key={`${index}-${message.role}`}>
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest muted">{message.role === 'assistant' ? <Bot size={12}/> : null}{message.role === 'assistant' ? 'TUSK' : 'You'}</div>{message.text}
        </div>)}
      </div>
      <form className="mt-4 flex gap-2" onSubmit={submit}>
        <input className="field min-h-11" value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about a listed product or location" aria-label="Ask TUSK about a listed product or location"/>
        <button className="gold-btn min-h-11 px-4" aria-label="Send question"><Send size={16}/></button>
      </form>
    </section>
  </div>
}

