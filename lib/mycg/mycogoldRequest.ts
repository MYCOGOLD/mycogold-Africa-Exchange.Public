// MYCOGOLD request helpers. MFPI 99.06654 / 52.00. MYCG DORMANT MAX 67M Issued 0. Kenyan Agricultural Exchange.
export class MycogoldTimeoutError extends Error {
  constructor() { super("MYCOGOLD request timed out"); this.name = "MycogoldTimeoutError"; }
}

export class MycogoldOfflineError extends Error {
  constructor() { super("Device is offline"); this.name = "MycogoldOfflineError"; }
}

export function mycogoldIdempotencyKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `mycg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type MycogoldRequestOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  timeoutMs?: number;
  retries?: number;
  idempotencyKey?: string;
  fetchImpl?: typeof fetch;
};

export async function mycogoldRequest(url: string, opts: MycogoldRequestOptions = {}): Promise<unknown> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new MycogoldOfflineError();
  const { method, body, timeoutMs = 15000, retries = 2, fetchImpl = fetch } = opts;
  const headers = new Headers(opts.headers);
  headers.set("X-Idempotency-Key", opts.idempotencyKey ?? mycogoldIdempotencyKey());
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(url, { method, headers, body, signal: controller.signal });
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof Error && error.name === "AbortError") {
        if (attempt < retries) { await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt)); continue; }
        throw new MycogoldTimeoutError();
      }
      throw error;
    }
    clearTimeout(timer);
    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }
    const text = await response.text();
    try { return JSON.parse(text); } catch { return text; }
  }
}

export function mycogoldOnce<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | undefined;
  let cached: { value: T; expiresAt: number } | undefined;
  return () => {
    if (inFlight) return inFlight;
    if (cached && Date.now() < cached.expiresAt) return Promise.resolve(cached.value);
    const current = Promise.resolve().then(fn).then(value => {
      cached = { value, expiresAt: Date.now() + 1000 };
      return value;
    }).finally(() => { if (inFlight === current) inFlight = undefined; });
    inFlight = current;
    return current;
  };
}

export function mycogoldIdleWatcher(
  onIdle: () => void,
  idleMs = 5 * 60 * 1000,
): { stop: () => void; reset: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  const events: (keyof WindowEventMap)[] = ["click", "keydown", "touchstart", "mousemove"];
  const reset = () => { clearTimeout(timer); timer = setTimeout(onIdle, idleMs); };
  if (typeof window !== "undefined") events.forEach(event => window.addEventListener(event, reset));
  reset();
  return {
    reset,
    stop: () => {
      clearTimeout(timer);
      if (typeof window !== "undefined") events.forEach(event => window.removeEventListener(event, reset));
    },
  };
}