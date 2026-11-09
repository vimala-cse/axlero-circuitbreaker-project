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

const KIND_LABEL = { live: 'Live', fallback: 'Backup', blocked: 'Blocked', error: 'Error' }

const listOf = (d) => (Array.isArray(d) ? d : (d && (d.products || d.items || d.content || d.data)) || [])
const rupees = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
// Live answers are a plain list; backup answers are { fallback, recommendations }.
const recsOf = (d) => (Array.isArray(d) ? d : (d && Array.isArray(d.recommendations) ? d.recommendations : []))
const idOf = (x) => (x && typeof x === 'object' ? x.productId ?? x.id : x)
const clock = () => new Date().toLocaleTimeString([], { hour12: false })

function Pill({ kind, children }) {
  return <span className={'pill ' + kind}>{children || KIND_LABEL[kind]}</span>
}

function Card({ title, hint, children, className = '', right }) {
  return (
      <section className={'card ' + className}>
        {title && (
            <header className="card-head">
              <div>
                <h2>{title}</h2>
                {hint && <p className="hint">{hint}</p>}
              </div>
              {right}
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

// A breaker lever: up = fine, middle = testing, down = stopped or down.
function Lever({ pos, tone }) {
  return <span className={'lever ' + pos + ' ' + tone} aria-hidden="true"><i /></span>
}

// ---------------------------------------------------------------
// Main app: one page, top to bottom.
// ---------------------------------------------------------------
export default function App() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('cb-theme') || 'auto' } catch { return 'auto' }
  })

  const [health, setHealth] = useState({})
  const [chaos, setChaos] = useState('normal')
  const [breakers, setBreakers] = useState(null)
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

  const seq = useRef(0)
  const haveCatalog = useRef(false)

  // ---- theme ---------------------------------------------------
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme)
    else root.removeAttribute('data-theme')
    try { localStorage.setItem('cb-theme', theme) } catch { /* ignore */ }
  }, [theme])
  const nextTheme = () => setTheme((t) => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto'))

  // ---- request log ---------------------------------------------
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

  // ---- polling: health, chaos mode, breaker state, catalog -----
  const loadCatalog = useCallback(async () => {
    const [p, s] = await Promise.all([timedFetch('/api/products'), timedFetch('/api/inventory')])
    if (p.ok) {
      setProducts(listOf(p.data))
      haveCatalog.current = true
    }
    if (s.ok) {
      if (Array.isArray(s.data)) {
        const map = {}
        s.data.forEach((x) => { map[idOf(x)] = x.quantity ?? x.stock ?? x.available ?? x.inStock ?? 0 })
        setStock(map)
      } else if (s.data && typeof s.data === 'object') {
        setStock(s.data) // { "P-101": 42, ... }
      }
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

  // ---- background traffic so the numbers move ------------------
  const gatewayUp = !!(health.gateway && health.gateway.up)
  useEffect(() => {
    if (!auto || !gatewayUp) return undefined
    const t = setInterval(async () => {
      const { r, kind } = await fetchRec(selected)
      setRec({ id: selected, kind, ms: r.ms, ids: recsOf(r.data) })
    }, 2500)
    return () => clearInterval(t)
  }, [auto, gatewayUp, selected, fetchRec])

  useEffect(() => {
    if (gatewayUp && !rec) pick(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatewayUp])

  // ---- actions -------------------------------------------------
  const burst = (n, id = selected) => Promise.all(Array.from({ length: n }, () => fetchRec(id)))

  const setMode = async (mode) => {
    const r = await timedFetch('/chaos?mode=' + mode + '&delayMs=4000', { method: 'POST' }, 4000)
    if (r.ok) setChaos((r.data && r.data.mode) || mode)
  }
  const triggerLatency = async () => { setBusy('latency'); await setMode('slow'); await burst(8); setBusy('') }
  const sendBurst = async () => { setBusy('burst'); await burst(12); setBusy('') }
  const recover = async () => { setBusy('recover'); await setMode('normal'); setBusy('') }

  const runRateTest = async () => {
    setBusy('rate')
    const rs = await Promise.all(Array.from({ length: 30 }, () => timedFetch('/api/products', {}, 6000)))
    setRateTest({ sent: rs.length, ok: rs.filter((r) => r.ok).length, blocked: rs.filter((r) => r.status === 429).length })
    setBusy('')
  }
  const runBulkTest = async () => {
    setBusy('bulk')
    const rs = await burst(15)
    const k = (name) => rs.filter((x) => x.kind === name).length
    setBulkTest({ sent: rs.length, live: k('live'), fallback: k('fallback'), blocked: k('blocked'), error: k('error') })
    setBusy('')
  }

  const pick = async (id) => {
    setSelected(id)
    const { r, kind } = await fetchRec(id)
    setRec({ id, kind, ms: r.ms, ids: recsOf(r.data) })
  }

  // ---- derived state -------------------------------------------
  const recDown = health.recommendation && !health.recommendation.up
  const recentFallbacks = log.slice(0, 3).length === 3 && log.slice(0, 3).every((e) => e.kind === 'fallback')
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
    sub = 'Start the api-gateway in IntelliJ (port 8080). This page wakes up by itself.'
    tone = 'bad'
  } else if (breakerState === 'OPEN') {
    headline = 'Breaker is open, shoppers see Top Sellers'
    sub = 'The gateway stopped calling Recommendation and answers with a backup. The rest of the shop stays fast.'
    tone = 'warn'
  } else if (breakerState === 'HALF_OPEN') {
    headline = 'Breaker is testing recovery'
    sub = 'A few trial requests are going through. If they pass, the breaker closes again.'
    tone = 'warn'
  } else if (recDown) {
    headline = 'Recommendation service is down'
    sub = 'The gateway covers with a backup answer. The rest of the shop still works.'
    tone = 'warn'
  } else if (chaos !== 'normal') {
    headline = chaos === 'slow' ? 'Recommendation is slowed on purpose' : 'Recommendation is failing on purpose'
    sub = 'This is a test. Watch how the gateway protects the shopper.'
    tone = 'warn'
  }

  // One place decides how each module looks.
  const moduleView = (key) => {
    const h = health[key]
    if (!h) return { pos: 'idle', tone: 'idle', label: 'Checking', detail: '…' }
    if (!h.up) return { pos: 'down', tone: 'bad', label: 'Down', detail: 'No answer' }
    if (key === 'recommendation') {
      if (breakerState === 'OPEN') return { pos: 'down', tone: 'bad', label: 'Breaker open', detail: 'Backup answers' }
      if (breakerState === 'HALF_OPEN') return { pos: 'mid', tone: 'warn', label: 'Testing', detail: 'Trial requests' }
      if (chaos !== 'normal') return { pos: 'up', tone: 'warn', label: chaos === 'slow' ? 'Slowed' : 'Failing', detail: 'On purpose' }
      const last = log.find((e) => e.kind === 'live')
      return { pos: 'up', tone: 'good', label: 'Healthy', detail: last ? 'Last answer ' + last.ms + ' ms' : 'Health check ' + h.ms + ' ms' }
    }
    return { pos: 'up', tone: 'good', label: 'Healthy', detail: 'Health check ' + h.ms + ' ms' }
  }

  const nameOf = (id) => (products.find((p) => idOf(p) === id) || {}).name || id
  const recIds = (rec && rec.ids) || []
  const modes = [
    { id: 'normal', label: 'Normal' },
    { id: 'slow', label: 'Slow (4 s)' },
    { id: 'fail', label: 'Fail (500)' },
  ]
  const b = realBreaker
  const pct = (v) => (v == null || v < 0 ? '–' : Number(v).toFixed(0) + '%')
  const stateInfo = {
    CLOSED: { word: 'Closed', tone: 'good', note: 'Requests go through.' },
    HALF_OPEN: { word: 'Half-open', tone: 'warn', note: 'Trying a few test requests.' },
    OPEN: { word: 'Open', tone: 'bad', note: 'Requests are stopped. Backup answer used.' },
  }[breakerState] || { word: breakerState, tone: 'idle', note: '' }

  return (
      <div className="app">
        <header className="top">
          <div className="top-in">
            <div className="brand">
            <span className="logo" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="22" height="22"><path d="M5 17h6l3-8 4 15 3-7h6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
              CircuitBreaker
            </div>
            <div className="top-right">
            <span className={'chip ' + (gatewayUp ? 'good' : 'bad')}>
              <i className="dot" />{gatewayUp ? 'Gateway online' : 'Gateway offline'}
            </span>
              <button className="chip btn-chip" onClick={nextTheme} title="Change theme">
                Theme: {theme === 'auto' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}
              </button>
            </div>
          </div>
        </header>

        <main className="wrap">
          <section className="headline">
            <h1><span className={'hdot ' + tone} />{headline}</h1>
            <p>{sub}</p>
          </section>

          {/* 1. Breaker panel: the state of every service at a glance */}
          <section className="board" aria-label="Breaker panel">
            <header className="board-head">
              <h2>Breaker panel</h2>
              <p>Lever up: healthy. Middle: testing. Down: stopped or not working.</p>
            </header>
            <div className="mods">
              {SERVICES.map((s) => {
                const v = moduleView(s.key)
                return (
                    <div key={s.key} className={'mod ' + v.tone}>
                      <div className="mod-text">
                        <b>{s.name}</b>
                        <span className="mod-id">{s.id} · :{s.port}</span>
                        <span className={'mod-state ' + v.tone}><i className="dot" />{v.label}</span>
                        <span className="mod-detail">{v.detail}</span>
                      </div>
                      <Lever pos={v.pos} tone={v.tone} />
                    </div>
                )
              })}
            </div>
          </section>

          {/* 2. Protection: what the gateway does to keep things safe */}
          <section aria-label="Protection">
            <h2 className="section-title">What protects the shop</h2>
            <div className="protect">
              <Card className="tile">
                <h3>Circuit breaker</h3>
                <p className={'big ' + stateInfo.tone}><i className="dot" />{stateInfo.word}</p>
                <p className="note">{stateInfo.note}</p>
                <p className="meta">
                  {b ? 'Failure rate ' + pct(b.failureRate) + ' · ' + b.bufferedCalls + ' calls in window' : 'Estimated from the last answers'}
                </p>
                <p className="meta faint">Opens at 50% failures or slow calls. Retries after 10 s.</p>
              </Card>

              <Card className="tile">
                <h3>Rate limiter</h3>
                <p className="note">Stops one visitor from flooding the gateway.</p>
                {rateTest ? (
                    <div className="result">
                      <div className="meter"><i className="ok" style={{ width: (rateTest.ok / rateTest.sent) * 100 + '%' }} /><i className="no" style={{ width: (rateTest.blocked / rateTest.sent) * 100 + '%' }} /></div>
                      <p className="meta"><b>{rateTest.ok}</b> allowed · <b>{rateTest.blocked}</b> blocked (429)</p>
                      {rateTest.blocked === 0 && <p className="meta faint">Nothing blocked, so it is not switched on yet.</p>}
                    </div>
                ) : <p className="meta faint">Not tested yet.</p>}
                <button className="btn small" disabled={!!busy} onClick={runRateTest}>{busy === 'rate' ? 'Sending…' : 'Test with 30 fast requests'}</button>
              </Card>

              <Card className="tile">
                <h3>Bulkhead</h3>
                <p className="note">Limits how many calls one route can hold at once.</p>
                {bulkTest ? (
                    <div className="result">
                      <div className="meter"><i className="ok" style={{ width: (bulkTest.live / bulkTest.sent) * 100 + '%' }} /><i className="mid" style={{ width: (bulkTest.fallback / bulkTest.sent) * 100 + '%' }} /><i className="no" style={{ width: (bulkTest.blocked / bulkTest.sent) * 100 + '%' }} /></div>
                      <p className="meta"><b>{bulkTest.live}</b> live · <b>{bulkTest.fallback}</b> backup · <b>{bulkTest.blocked}</b> rejected</p>
                      {bulkTest.blocked === 0 && <p className="meta faint">Nothing rejected, so the limit is not active yet.</p>}
                    </div>
                ) : <p className="meta faint">Not tested yet.</p>}
                <button className="btn small" disabled={!!busy} onClick={runBulkTest}>{busy === 'bulk' ? 'Sending…' : 'Test with 15 at once'}</button>
              </Card>

              <Card className="tile">
                <h3>Request tracing</h3>
                <p className="note">One trace id follows a request through the gateway and every service.</p>
                <p className="meta faint">Each request you send here can be found in Zipkin.</p>
                <a className="btn small ghost" href={ZIPKIN_URL} target="_blank" rel="noreferrer">Open Zipkin</a>
              </Card>
            </div>
          </section>

          {/* 3. Chaos + live requests */}
          <div className="two">
            <Card title="Break something on purpose" hint={'Recommendation is in ' + chaos + ' mode. No restart needed.'}>
              <div className="seg" role="group" aria-label="Recommendation behaviour">
                {modes.map((m) => (
                    <button key={m.id} className={chaos === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>{m.label}</button>
                ))}
              </div>
              <div className="row-actions">
                <button className="btn warn" disabled={!!busy} onClick={triggerLatency}>{busy === 'latency' ? 'Sending…' : 'Trigger latency'}</button>
                <button className="btn" disabled={!!busy} onClick={sendBurst}>{busy === 'burst' ? 'Sending…' : 'Send 12 at once'}</button>
                <button className="btn ghost" disabled={!!busy} onClick={recover}>Back to normal</button>
              </div>
              <label className="check">
                <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                Send one request every 2.5 s
              </label>
              <p className="tip"><b>Try it:</b> press Trigger latency, watch the Recommendation lever drop, then press Back to normal and wait about 10 s.</p>
            </Card>

            <Card title="Live requests" hint="Newest first" right={<button className="link" onClick={() => { setLog([]); setCounts({ live: 0, fallback: 0, blocked: 0, error: 0 }) }}>Clear</button>}>
              <div className="stats">
                <Stat value={counts.live} label="Live" tone="good" />
                <Stat value={counts.fallback} label="Backup" tone="warn" />
                <Stat value={counts.blocked} label="Blocked" tone="info" />
                <Stat value={counts.error} label="Error" tone="bad" />
              </div>
              {log.length === 0 ? <p className="empty">No requests yet.</p> : (
                  <ul className="log">
                    {log.slice(0, 12).map((e) => (
                        <li key={e.key}>
                          <span className="t">{e.time}</span>
                          <span className="id">{e.id}</span>
                          <Pill kind={e.kind} />
                          <span className="ms">{e.ms} ms</span>
                        </li>
                    ))}
                  </ul>
              )}
            </Card>
          </div>

          {/* 4. What the shopper sees */}
          <Card title="What the shopper sees" hint="Pick a product to load its recommendations.">
            {products.length === 0 ? <p className="empty">No products yet. Make sure the gateway and Product service are running.</p> : (
                <div className="products">
                  {products.map((x) => {
                    const id = idOf(x)
                    const qty = stock[id]
                    return (
                        <button key={id} className={'product' + (selected === id ? ' on' : '')} onClick={() => pick(id)}>
                          <small>{x.category}</small>
                          <b>{x.name}</b>
                          <span className="price">{rupees(x.price)}</span>
                          <span className={'stock ' + (qty === 0 ? 'out' : '')}>{qty === undefined ? '' : qty === 0 ? 'Out of stock' : qty + ' in stock'}</span>
                        </button>
                    )
                  })}
                </div>
            )}
            <div className="rec">
              <div className="rec-head">
                <h3>You may also like, with {nameOf(selected)}</h3>
                {rec && <><Pill kind={rec.kind} /><span className="ms">{rec.ms} ms</span></>}
              </div>
              <div className="chips">
                {recIds.map((r, i) => <span key={i} className="chipx">{nameOf(idOf(r))}</span>)}
                {rec && recIds.length === 0 && <span className="empty">No recommendations returned.</span>}
              </div>
            </div>
            <p className="hint">Live means Recommendation answered. Backup means the gateway answered with Top Sellers because the service was slow, failing, or the breaker was open.</p>
          </Card>
        </main>
      </div>
  )
}
