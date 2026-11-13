'use client';
import { useCallback, useEffect, useState } from 'react';

type LedgerTrade = {
  trade_id: string;
  category: string | null;
  variety: string | null;
  price_kes: number;
  kg: number;
  verified_at: string;
};

type State = 'loading' | 'unauthenticated' | 'empty' | 'ready' | 'error';

export function TradeLedger() {
  const [trades, setTrades] = useState<LedgerTrade[]>([]);
  const [state, setState] = useState<State>('loading');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const load = useCallback(async (cat: string) => {
    setRefreshing(true);
    try {
      const url = cat ? `/api/trades/ledger?category=${encodeURIComponent(cat)}` : '/api/trades/ledger';
      const res = await fetch(url, { cache: 'no-store' });
      if (res.status === 401) { setState('unauthenticated'); setTrades([]); return; }
      if (!res.ok) { setState('error'); return; }
      const json = await res.json();
      const rows = (json.trades ?? []) as LedgerTrade[];
      setTrades(rows);
      setState(rows.length === 0 ? 'empty' : 'ready');
      setLastUpdated(new Date().toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi' }));
      // Categories from REAL rows only - no hardcoded list
      if (!cat) {
        const cats = Array.from(new Set(rows.map(r => r.category).filter(Boolean) as string[])).sort();
        setCategories(cats);
      }
    } catch {
      setState('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(''); }, [load]);

  const onRefresh = () => load(category);
  const onCategory = (c: string) => { setCategory(c); load(c); };

  return (
    <section aria-label="Trade ledger">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2>Trade ledger</h2>
        {/* DYNAMIC BUTTON - real fetch, not a static link */}
        <button onClick={onRefresh} disabled={refreshing} aria-live="polite">
          {refreshing ? 'Refreshing…' : 'Refresh ledger'}
        </button>
      </div>

      {lastUpdated && <p>Last updated {lastUpdated} Africa/Nairobi • Source: verified trades only</p>}

      <label>
        Filter by category
        <select value={category} onChange={(e) => onCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      {state === 'loading' && <p>Loading verified trades…</p>}
      {state === 'unauthenticated' && <p>Sign in to view the trade ledger.</p>}
      {state === 'error' && <p>Trade ledger unavailable. Tap Refresh to try again.</p>}
      {state === 'empty' && (
        <p>No server-authoritative completed trades are recorded yet. The local demo ledger is not a blockchain or settlement record.</p>
      )}
      {state === 'ready' && (
        <table>
          <thead><tr><th>Trade</th><th>Category</th><th>Price KES/kg</th><th>Kg</th><th>Verified</th></tr></thead>
          <tbody>
            {trades.map(t => (
              <tr key={t.trade_id}>
                <td>{t.trade_id.slice(0, 8)}…</td>
                <td>{t.category ?? '—'} {t.variety ? `• ${t.variety}` : ''}</td>
                <td>{Number(t.price_kes).toLocaleString('en-KE')}</td>
                <td>{Number(t.kg).toLocaleString('en-KE')}</td>
                <td>{new Date(t.verified_at).toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>Asking prices from listings are NOT in this ledger. Only verified trades appear here.</p>
    </section>
  );
}
