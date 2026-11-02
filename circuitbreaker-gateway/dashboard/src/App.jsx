import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

// ---------------------------------------------------------------
// Settings. Change these only if your ports are different.
// ---------------------------------------------------------------
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
const ZIPKIN_URL = import.meta.env.VITE_ZIPKIN_URL || 'http://localhost:9411'

const SERVICES = [
  { key: 'product', name: 'Product', id: 'product-service', port: 8081, url: '/services/product/health' },
  { key: 'inventory', name: 'Inventory', id: 'inventory-service', port: 8082, url: '/services/inventory/health' },
  { key: 'recommendation', name: 'Recommendation', id: 'recommendation-service', port: 8083, url: '/services/recommendation/health' },
  { key: 'gateway', name: 'API Gateway', id: 'api-gateway', port: 8080, url: '/actuator/health' },
]

const PAGES = [
  { id: 'overview', label: 'Overview' },
  { id: 'chaos', label: 'Chaos Lab' },
  { id: 'resilience', label: 'Resilience' },
  { id: 'tracing', label: 'Tracing' },
  { id: 'shop', label: 'Storefront' },
]

// ---------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------

// fetch that never throws: always gives back { ok, status, ms, data }.
async function timedFetch(path, options = {}, timeoutMs = 6000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const t0 = performance.now()
  try {
    const res = await fetch(API_BASE + path, { ...options, signal: ctrl.signal })
    let data = null
    try { data = await res.json() } catch { data = null }
    return { ok: res.ok, status: res.status, ms: Math.round(performance.now() - t0), data }
  } catch (e) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - t0), data: null, error: e.name === 'AbortError' ? 'timeout' : 'network' }
  } finally {
    clearTimeout(timer)
  }
}

// live = real answer, fallback = gateway's backup answer,
// blocked = gateway refused (rate limit / bulkhead), error = nothing worked.
function classify(r) {
  if (r.status === 429 || r.status === 503) return 'blocked'
  if (r.ok) return r.data && r.data.fallback ? 'fallback' : 'live'
  return 'error'
}

const KIND_LABEL = { live: 'Live', fallback: 'Fallback', blocked: 'Blocked', error: 'Error' }

const listOf = (d) => (Array.isArray(d) ? d : (d && (d.products || d.items || d.content || d.data)) || [])
const rupees = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
const idOf = (x) => (x && typeof x === 'object' ? x.productId ?? x.id : x)
const clock = () => new Date().toLocaleTimeString([], { hour12: false })

function Pill({ kind, children }) {
  return <span className={'pill ' + kind}>{children || KIND_LABEL[kind]}</span>
}

function Card({ title, hint, tag, children, className = '' }) {
  return (
      <section className={'card ' + className}>
        {(title || tag) && (
            <header className="card-head">
              <div>
                <h2>{title}</h2>
                {hint && <p className="hint">{hint}</p>}
              </div>
              {tag && <span className="tag">{tag}</span>}
            </header>
        )}
        {children}
      </section>
  )
}

function Stat({ value, label, tone }) {
  return (
      <div className={'stat ' + (tone || '')}>
        <b>{value}</b>
        <span>{label}</span>
      </div>
  )
}

// ---------------------------------------------------------------
// Main app
// ---------------------------------------------------------------
export default function App() {
  const [page, setPage] = useState(() => (window.location.hash || '#overview').slice(1))
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('cb-theme') || 'auto' } catch { return 'auto' }
  })

  const [health, setHealth] = useState({})           // key -> { up, ms }
  const [chaos, setChaos] = useState('normal')
  const [breakers, setBreakers] = useState(null)     // null = gateway has no breaker endpoint yet
  const [products, setProducts] = useState([])
  const [stock, setStock] = useState({})
  const [selected, setSelected] = useState('P-101')
  const [rec, setRec] = useState(null)
  const [auto, setAuto] = useState(true)
  const [busy, setBusy] = useState('')
  const [log, setLog] = useState([])
  const [counts, setCounts] = useState({ live: 0, fallback: 0, blocked: 0, error: 0 })
  const [rateTest, setRateTest] = useState(null)
  const [bulkTest, setBulkTest] = useState(null)
  const [traceTest, setTraceTest] = useState(null)

  const seq = useRef(0)
  const haveCatalog = useRef(false)

  // ---- page + theme -------------------------------------------
  useEffect(() => {
    const onHash = () => setPage((window.location.hash || '#overview').slice(1))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = (id) => { window.location.hash = id; window.scrollTo({ top: 0 }) }

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme)
    else root.removeAttribute('data-theme')
    try { localStorage.setItem('cb-theme', theme) } catch { /* ignore */ }
  }, [theme])
  const nextTheme = () => setTheme((t) => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto'))

  // ---- request log --------------------------------------------
  const record = useCallback((id, r) => {
    const kind = classify(r)
    seq.current += 1
    const row = { key: seq.current, time: clock(), id, kind, ms: r.ms }
    setLog((l) => [row, ...l].slice(0, 40))
    setCounts((c) => ({ ...c, [kind]: c[kind] + 1 }))
    return kind
  }, [])

  const fetchRec = useCallback(async (id) => {
    const r = await timedFetch('/api/recommendations/' + id, {}, 9000)
    const kind = record(id, r)
    return { r, kind }
  }, [record])

  // ---- polling: health, chaos mode, breaker state, catalog ----
  const loadCatalog = useCallback(async () => {
    const [p, s] = await Promise.all([timedFetch('/api/products'), timedFetch('/api/inventory')])
    if (p.ok) {
      setProducts(listOf(p.data))
      haveCatalog.current = true
    }
    if (s.ok) {
      const map = {}
      listOf(s.data).forEach((x) => { map[idOf(x)] = x.quantity ?? x.stock ?? x.available ?? x.inStock ?? 0 })
      setStock(map)
    }
  }, [])

  useEffect(() => {
    let stop = false
    const tick = async () => {
      const [hs, br, cz] = await Promise.all([
        Promise.all(SERVICES.map((s) => timedFetch(s.url, {}, 3000))),
        timedFetch('/gateway/breakers', {}, 3000),
        timedFetch('/chaos', {}, 3000),
      ])
      if (stop) return
      const h = {}
      SERVICES.forEach((s, i) => {
        const r = hs[i]
        h[s.key] = { up: r.ok && (!r.data || !r.data.status || r.data.status === 'UP'), ms: r.ms }
      })
      setHealth(h)
      setBreakers(br.ok && Array.isArray(br.data) ? br.data : null)
      if (cz.ok && cz.data && cz.data.mode) setChaos(cz.data.mode)
      if (!haveCatalog.current && h.gateway.up) loadCatalog()
    }
    tick()
    const t = setInterval(tick, 3000)
    return () => { stop = true; clearInterval(t) }
  }, [loadCatalog])

  // ---- gentle background traffic so the numbers move ----------
  const gatewayUp = !!(health.gateway && health.gateway.up)
  useEffect(() => {
    if (!auto || !gatewayUp) return undefined
    const t = setInterval(async () => {
      const { r, kind } = await fetchRec(selected)
      setRec({ id: selected, kind, ms: r.ms, ids: (r.data && r.data.recommendations) || [] })
    }, 2500)
    return () => clearInterval(t)
  }, [auto, gatewayUp, selected, fetchRec])

  // ---- actions ------------------------------------------------
  const burst = (n, id = selected) => Promise.all(Array.from({ length: n }, () => fetchRec(id)))

  const setMode = async (mode) => {
    const r = await timedFetch('/chaos?mode=' + mode + '&delayMs=4000', { method: 'POST' }, 4000)
    if (r.ok) setChaos((r.data && r.data.mode) || mode)
    return r.ok
  }

  const triggerLatency = async () => {
    setBusy('latency')
    await setMode('slow')
    await burst(8)
    setBusy('')
  }
  const sendBurst = async () => { setBusy('burst'); await burst(12); setBusy('') }
  const recover = async () => { setBusy('recover'); await setMode('normal'); setBusy('') }

  const runRateTest = async () => {
    setBusy('rate')
    const t0 = performance.now()
    const rs = await Promise.all(Array.from({ length: 30 }, () => timedFetch('/api/products', {}, 6000)))
    const blocked = rs.filter((r) => r.status === 429).length
    const ok = rs.filter((r) => r.ok).length
    setRateTest({ sent: rs.length, ok, blocked, ms: Math.round(performance.now() - t0) })
    setBusy('')
  }

  const runBulkTest = async () => {
    setBusy('bulk')
    const t0 = performance.now()
    const rs = await burst(15)
    const k = (name) => rs.filter((x) => x.kind === name).length
    setBulkTest({ sent: rs.length, live: k('live'), fallback: k('fallback'), blocked: k('blocked'), error: k('error'), ms: Math.round(performance.now() - t0) })
    setBusy('')
  }

  const runTrace = async () => {
    setBusy('trace')
    const { r, kind } = await fetchRec(selected)
    setTraceTest({ at: clock(), kind, ms: r.ms })
    setBusy('')
  }

  const pick = async (id) => {
    setSelected(id)
    const { r, kind } = await fetchRec(id)
    setRec({ id, kind, ms: r.ms, ids: (r.data && r.data.recommendations) || [] })
  }

  // Opening the Storefront should show recommendations straight away.
  useEffect(() => {
    if (page === 'shop' && !rec && gatewayUp) pick(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, gatewayUp])

  // ---- derived state ------------------------------------------
  const recDown = health.recommendation && !health.recommendation.up
  const recentFallbacks = log.slice(0, 3).length === 3 && log.slice(0, 3).every((e) => e.kind === 'fallback')

  // Real breaker (from the gateway) when available, otherwise an estimate.
  const realBreaker = breakers && (breakers.find((b) => /recommend/i.test(b.name)) || breakers[0])
  let breakerState = 'CLOSED'
  let estimated = false
  if (realBreaker) {
    breakerState = String(realBreaker.state).replace('FORCED_', '')
    if (breakerState === 'DISABLED') breakerState = 'CLOSED'
  } else {
    estimated = true
    if (recentFallbacks) breakerState = 'OPEN'
  }

  let headline = 'All services healthy'
  let sub = 'Every request goes through the gateway, and recommendations are coming live.'
  let tone = 'good'
  if (health.gateway && !health.gateway.up) {
    headline = 'Gateway is not reachable'
    sub = 'Start the api-gateway in IntelliJ (port 8080), then this page will wake up by itself.'
    tone = 'bad'
  } else if (breakerState === 'OPEN') {
    headline = 'Breaker is open, shoppers see Top Sellers'
    sub = 'The gateway stopped calling Recommendation and answers with a backup. Everything else stays fast.'
    tone = 'warn'
  } else if (breakerState === 'HALF_OPEN') {
    headline = 'Breaker is testing recovery'
    sub = 'A few trial requests are going through. If they pass, the breaker closes again.'
    tone = 'warn'
  } else if (recDown) {
    headline = 'Recommendation service is down'
    sub = 'The gateway is covering with a backup answer. The rest of the shop still works.'
    tone = 'warn'
  } else if (chaos !== 'normal') {
    headline = chaos === 'slow' ? 'Recommendation is slowed on purpose' : 'Recommendation is failing on purpose'
    sub = 'This is a test. Watch how the gateway protects the shopper.'
    tone = 'warn'
  }

  const statusOf = (key) => {
    const h = health[key]
    if (!h) return 'idle'
    if (!h.up) return 'bad'
    if (key === 'recommendation' && (breakerState === 'OPEN' || chaos !== 'normal')) return 'warn'
    return 'good'
  }
  const statusText = { good: 'Healthy', warn: 'Protected', bad: 'Down', idle: 'Checking' }
  const nameOf = (id) => (products.find((p) => idOf(p) === id) || {}).name || id

  const ctx = {
    health, chaos, breakers, realBreaker, breakerState, estimated, products, stock, selected, rec, auto, busy, log, counts,
    rateTest, bulkTest, traceTest, headline, sub, tone, statusOf, statusText, nameOf,
    setAuto, setMode, triggerLatency, sendBurst, recover, runRateTest, runBulkTest, runTrace, pick, go,
  }

  return (
      <div className="app">
        <header className="top">
          <div className="top-in">
            <a className="brand" href="#overview" onClick={() => go('overview')}>
            <span className="logo" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="22" height="22"><path d="M5 17h6l3-8 4 15 3-7h6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
              CircuitBreaker
            </a>
            <nav className="tabs" aria-label="Pages">
              {PAGES.map((p) => (
                  <button key={p.id} className={page === p.id ? 'tab on' : 'tab'} onClick={() => go(p.id)}>{p.label}</button>
              ))}
            </nav>
            <div className="top-right">
            <span className={'chip ' + (gatewayUp ? 'good' : 'bad')}>
              <i className="dot" />{gatewayUp ? 'Gateway online' : 'Gateway offline'}
            </span>
              <button className="chip btn-chip" onClick={nextTheme} title="Change theme">
                {theme === 'auto' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}
              </button>
            </div>
          </div>
        </header>

        <main className="wrap">
          {page === 'chaos' && <ChaosPage {...ctx} />}
          {page === 'resilience' && <ResiliencePage {...ctx} />}
          {page === 'tracing' && <TracingPage {...ctx} />}
          {page === 'shop' && <ShopPage {...ctx} />}
          {!['chaos', 'resilience', 'tracing', 'shop'].includes(page) && <OverviewPage {...ctx} />}
        </main>

        <footer className="foot">CircuitBreaker · Spring Cloud Gateway + Resilience4j · Axlero internship project</footer>
      </div>
  )
}

// ---------------------------------------------------------------
// Pages
// ---------------------------------------------------------------
function Hero({ headline, sub, tone }) {
  return (
      <div className={'hero ' + tone}>
        <span className="hero-dot" />
        <div>
          <h1>{headline}</h1>
          <p>{sub}</p>
        </div>
      </div>
  )
}

function OverviewPage(p) {
  const { counts } = p
  const total = counts.live + counts.fallback + counts.blocked + counts.error
  return (
      <>
        <Hero headline={p.headline} sub={p.sub} tone={p.tone} />

        <Card title="How a request travels" hint="The gateway is the only door. It routes, limits and protects.">
          <div className="flow">
            <div className="node plain"><b>Shopper</b><small>Browser</small></div>
            <span className="arrow" aria-hidden="true" />
            <div className={'node big ' + p.statusOf('gateway')}>
              <b>API Gateway</b>
              <small>Routes · Rate limit · Circuit breaker</small>
            </div>
            <span className="arrow" aria-hidden="true" />
            <div className="targets">
              {SERVICES.filter((s) => s.key !== 'gateway').map((s) => (
                  <div key={s.key} className={'node ' + p.statusOf(s.key)}>
                    <b>{s.name}</b>
                    {s.key === 'recommendation' && <small>Breaker: {p.breakerState.replace('_', '-').toLowerCase()}</small>}
                  </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid4">
          {SERVICES.map((s) => {
            const st = p.statusOf(s.key)
            const h = p.health[s.key]
            return (
                <div key={s.key} className={'svc ' + st}>
                  <div className="svc-top">
                    <b>{s.name}</b>
                    <span className={'badge ' + st}><i className="dot" />{p.statusText[st]}</span>
                  </div>
                  <span className="svc-id">{s.id} · :{s.port}</span>
                  <span className="svc-ms">{h ? (h.up ? 'Health check ' + h.ms + ' ms' : 'No answer') : '…'}</span>
                </div>
            )
          })}
        </div>

        <Card title="Requests so far" hint={total === 0 ? 'Numbers appear as soon as traffic flows.' : 'Everything the shopper side has asked for, grouped by what happened.'}>
          <div className="stats">
            <Stat value={counts.live} label="Live answers" tone="good" />
            <Stat value={counts.fallback} label="Fallback answers" tone="warn" />
            <Stat value={counts.blocked} label="Blocked" tone="info" />
            <Stat value={counts.error} label="Errors" tone="bad" />
          </div>
          <div className="row-actions">
            <button className="btn" onClick={() => p.go('chaos')}>Open Chaos Lab</button>
            <button className="btn ghost" onClick={() => p.go('resilience')}>See breaker state</button>
          </div>
        </Card>
      </>
  )
}

function LogList({ log }) {
  if (log.length === 0) return <p className="empty">No requests yet. They show up here as they happen.</p>
  return (
      <ul className="log">
        {log.slice(0, 14).map((e) => (
            <li key={e.key}>
              <span className="t">{e.time}</span>
              <span className="id">{e.id}</span>
              <Pill kind={e.kind} />
              <span className="ms">{e.ms} ms</span>
            </li>
        ))}
      </ul>
  )
}

function ChaosPage(p) {
  const modes = [
    { id: 'normal', label: 'Normal' },
    { id: 'slow', label: 'Slow (4 s)' },
    { id: 'fail', label: 'Fail (500)' },
  ]
  const { counts } = p
  return (
      <>
        <div className="page-title">
          <h1>Chaos Lab</h1>
          <p>Break the Recommendation service on purpose and watch the gateway protect the shopper. No restart needed.</p>
        </div>

        <div className="two">
          <Card title="Make it misbehave" hint={'Current mode: ' + p.chaos}>
            <div className="seg" role="group" aria-label="Recommendation behaviour">
              {modes.map((m) => (
                  <button key={m.id} className={p.chaos === m.id ? 'on' : ''} onClick={() => p.setMode(m.id)}>{m.label}</button>
              ))}
            </div>

            <div className="row-actions">
              <button className="btn warn" disabled={!!p.busy} onClick={p.triggerLatency}>
                {p.busy === 'latency' ? 'Sending…' : 'Trigger latency'}
              </button>
              <button className="btn" disabled={!!p.busy} onClick={p.sendBurst}>
                {p.busy === 'burst' ? 'Sending…' : 'Send 12 at once'}
              </button>
              <button className="btn ghost" disabled={!!p.busy} onClick={p.recover}>Back to normal</button>
            </div>

            <label className="check">
              <input type="checkbox" checked={p.auto} onChange={(e) => p.setAuto(e.target.checked)} />
              Send one request every 2.5 s so the numbers keep moving
            </label>

            <ol className="steps">
              <li>Press <b>Trigger latency</b>. Recommendation becomes slow and 8 requests go out.</li>
              <li>The gateway gives up after 3 s and shows <b>Top Sellers</b> instead.</li>
              <li>Open <b>Resilience</b> to see the breaker turn red. Then press <b>Back to normal</b> and wait about 10 s.</li>
            </ol>
          </Card>

          <Card title="Live requests" hint="Newest first">
            <div className="stats small">
              <Stat value={counts.live} label="Live" tone="good" />
              <Stat value={counts.fallback} label="Fallback" tone="warn" />
              <Stat value={counts.blocked} label="Blocked" tone="info" />
              <Stat value={counts.error} label="Error" tone="bad" />
            </div>
            <LogList log={p.log} />
          </Card>
        </div>
      </>
  )
}

const STATES = [
  { id: 'CLOSED', label: 'Closed', note: 'Everything is fine. Requests go through.' },
  { id: 'HALF_OPEN', label: 'Half-open', note: 'Trying a few requests to see if it recovered.' },
  { id: 'OPEN', label: 'Open', note: 'Too many failures. Requests are stopped and the backup answer is used.' },
]

function ResiliencePage(p) {
  const b = p.realBreaker
  const pct = (v) => (v == null || v < 0 ? '–' : Number(v).toFixed(0) + '%')
  const rt = p.rateTest
  const bt = p.bulkTest
  return (
      <>
        <div className="page-title">
          <h1>Resilience</h1>
          <p>The three protections the gateway puts in front of your services.</p>
        </div>

        <Card
            title="Circuit breaker"
            hint="Route: Recommendation service"
            tag={p.estimated ? 'Estimated from responses' : 'Live from gateway'}
        >
          <div className="states">
            {STATES.map((s) => (
                <div key={s.id} className={'state ' + s.id + (p.breakerState === s.id ? ' on' : '')}>
                  <span className="state-dot" />
                  <b>{s.label}</b>
                  <small>{s.note}</small>
                </div>
            ))}
          </div>

          <div className="stats small">
            <Stat value={b ? pct(b.failureRate) : '–'} label="Failure rate" />
            <Stat value={b ? pct(b.slowCallRate) : '–'} label="Slow-call rate" />
            <Stat value={b ? b.bufferedCalls : '–'} label="Calls in window" />
            <Stat value={b ? b.notPermittedCalls : '–'} label="Stopped by breaker" tone="warn" />
          </div>
          <p className="rule">
            Rule: the breaker opens when half of the last 10 calls fail or run slower than 2 s. It waits 10 s, then tries 3 test calls.
            {p.estimated && ' Exact numbers show up once the gateway breaker endpoint (/gateway/breakers) is added.'}
          </p>
        </Card>

        <div className="two">
          <Card title="Rate limiter" hint="Stops one visitor from flooding the gateway" tag="Week 3">
            <button className="btn" disabled={!!p.busy} onClick={p.runRateTest}>
              {p.busy === 'rate' ? 'Sending…' : 'Send 30 requests very fast'}
            </button>
            {rt ? (
                <div className="result">
                  <div className="meter"><i className="ok" style={{ width: (rt.ok / rt.sent) * 100 + '%' }} /><i className="no" style={{ width: (rt.blocked / rt.sent) * 100 + '%' }} /></div>
                  <p><b>{rt.ok}</b> allowed · <b>{rt.blocked}</b> blocked (HTTP 429) · took {rt.ms} ms</p>
                  {rt.blocked === 0 && <p className="hint">Nothing was blocked, so the rate limiter is not switched on in the gateway yet.</p>}
                </div>
            ) : <p className="hint">Not tested yet.</p>}
          </Card>

          <Card title="Bulkhead" hint="Limits how many calls one route can hold at the same time" tag="Week 3">
            <button className="btn" disabled={!!p.busy} onClick={p.runBulkTest}>
              {p.busy === 'bulk' ? 'Sending…' : 'Send 15 at the same time'}
            </button>
            {bt ? (
                <div className="result">
                  <div className="meter"><i className="ok" style={{ width: (bt.live / bt.sent) * 100 + '%' }} /><i className="mid" style={{ width: (bt.fallback / bt.sent) * 100 + '%' }} /><i className="no" style={{ width: (bt.blocked / bt.sent) * 100 + '%' }} /></div>
                  <p><b>{bt.live}</b> live · <b>{bt.fallback}</b> fallback · <b>{bt.blocked}</b> rejected · took {bt.ms} ms</p>
                  {bt.blocked === 0 && <p className="hint">No call was rejected, so the bulkhead limit is not active yet. Try it with Recommendation set to Slow.</p>}
                </div>
            ) : <p className="hint">Not tested yet. Works best with Recommendation set to Slow.</p>}
          </Card>
        </div>
      </>
  )
}

function TracingPage(p) {
  const t = p.traceTest
  return (
      <>
        <div className="page-title">
          <h1>Tracing</h1>
          <p>Follow one request as it hops from the gateway to the services. Zipkin draws the whole path.</p>
        </div>

        <Card title="One request, many hops" tag="Week 4">
          <div className="hops">
            <div className="hop"><b>1 · Browser</b><small>asks the gateway</small></div>
            <div className="hop"><b>2 · API Gateway</b><small>finds the service in Eureka</small></div>
            <div className="hop"><b>3 · Recommendation</b><small>builds the answer</small></div>
            <div className="hop"><b>4 · Back to browser</b><small>live or fallback</small></div>
          </div>
          <p className="rule">Each hop gets the same trace id, so Zipkin can show all of them as one timeline with the time spent in every step.</p>

          <div className="row-actions">
            <button className="btn" disabled={!!p.busy} onClick={p.runTrace}>
              {p.busy === 'trace' ? 'Sending…' : 'Send a request to trace'}
            </button>
            <a className="btn ghost" href={ZIPKIN_URL} target="_blank" rel="noreferrer">Open Zipkin</a>
          </div>

          {t && (
              <p className="result-line">
                Sent at {t.at}, answered <Pill kind={t.kind} /> in <b>{t.ms} ms</b>. Open Zipkin and press Run Query to see it.
              </p>
          )}
          <p className="hint">If Zipkin does not open, start it with: docker run -p 9411:9411 openzipkin/zipkin</p>
        </Card>
      </>
  )
}

function ShopPage(p) {
  const recIds = (p.rec && p.rec.ids) || []
  return (
      <>
        <div className="page-title">
          <h1>Storefront</h1>
          <p>This is what a shopper sees. Pick a product to load its recommendations.</p>
        </div>

        {p.products.length === 0 ? (
            <Card><p className="empty">No products yet. Make sure the gateway and Product service are running.</p></Card>
        ) : (
            <div className="products">
              {p.products.map((x) => {
                const id = idOf(x)
                const qty = p.stock[id]
                return (
                    <button key={id} className={'product' + (p.selected === id ? ' on' : '')} onClick={() => p.pick(id)}>
                      <small>{x.category}</small>
                      <b>{x.name}</b>
                      <span className="price">{rupees(x.price)}</span>
                      <span className={'stock ' + (qty === 0 ? 'out' : '')}>{qty === undefined ? '' : qty === 0 ? 'Out of stock' : qty + ' in stock'}</span>
                    </button>
                )
              })}
            </div>
        )}

        <Card
            title={'You may also like, with ' + p.nameOf(p.selected)}
        >
          {p.rec ? (
              <>
                <div className="rec-meta"><Pill kind={p.rec.kind} /><span>{p.rec.ms} ms</span></div>
                <div className="chips">
                  {recIds.map((r, i) => <span key={i} className="chipx">{p.nameOf(idOf(r))}</span>)}
                  {recIds.length === 0 && <span className="empty">No recommendations returned.</span>}
                </div>
              </>
          ) : <p className="empty">Pick a product above.</p>}
          <p className="hint">Live means Recommendation answered. Fallback means the gateway answered with Top Sellers because the service was slow, failing, or the breaker was open.</p>
        </Card>
      </>
  )
}
