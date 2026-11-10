'use client'

import { useState } from 'react'
import { Bot, Send } from 'lucide-react'
import type { Listing } from './types'

type Message = { role: 'user' | 'assistant'; text: string }

export function TuskChat({ listings: _listings }: { listings: Listing[] }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: 'Hello, I am TUSK. I can explain MycoGold marketplace information and agricultural topics. I will distinguish seller asking prices from verified market prices, and I will tell you when data is not yet available.',
    },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)

  async function send(value = input) {
    const question = value.trim()
    if (!question || thinking) return

    setInput('')
    setMessages((current) => [...current, { role: 'user', text: question }])
    setThinking(true)

    try {
      const response = await fetch('/api/tusk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ question }),
      })
      const result = await response.json().catch(() => ({})) as {
        answer?: string
        error?: string
      }

      if (!response.ok || typeof result.answer !== 'string') {
        throw new Error(result.error || 'TUSK could not answer just now.')
      }

      setMessages((current) => [...current, { role: 'assistant', text: result.answer as string }])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'TUSK could not answer just now.'
      setMessages((current) => [...current, { role: 'assistant', text: message }])
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="glass p-4">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        <button type="button" className="ghost-btn shrink-0" disabled={thinking} onClick={() => void send('How should I compare produce listings fairly?')}>Compare listings</button>
        <button type="button" className="ghost-btn shrink-0" disabled={thinking} onClick={() => void send('What information is needed before MFPI can be published?')}>Explain MFPI</button>
        <button type="button" className="ghost-btn shrink-0" disabled={thinking} onClick={() => void send('How can farmers and buyers trade safely?')}>Trade safely</button>
        <button type="button" className="ghost-btn shrink-0" disabled={thinking} onClick={() => void send('How will verified activity rewards work?')}>Rewards rules</button>
      </div>

      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto" aria-live="polite">
        {messages.map((message, index) => (
          <div
            className={message.role === 'user'
              ? 'ml-8 rounded-xl bg-[#ffd60a] p-3 text-sm text-black'
              : 'mr-8 rounded-xl bg-white/[.05] p-3 text-sm'}
            key={index}
          >
            <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest muted">
              {message.role === 'assistant' ? <Bot size={12} /> : null}
              {message.role === 'assistant' ? 'TUSK AI' : 'You'}
            </div>
            <p className="whitespace-pre-wrap">{message.text}</p>
          </div>
        ))}
        {thinking && <div className="muted text-sm">TUSK is checking the available MycoGold information…</div>}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <input
          className="field min-h-11"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask TUSK about produce, MFPI or rewards"
          aria-label="Ask TUSK a question"
          maxLength={1000}
          disabled={thinking}
        />
        <button
          type="submit"
          className="gold-btn min-h-11 px-4"
          aria-label="Send question"
          disabled={thinking || !input.trim()}
        >
          <Send size={16} />
        </button>
      </form>
      <p className="mt-3 text-[11px] muted">
        TUSK is an information assistant. It cannot verify transactions, issue rewards, or release payments.
      </p>
    </div>
  )
}
