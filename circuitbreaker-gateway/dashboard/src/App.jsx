import { useCallback, useEffect, useRef, useState } from 'react'

// Everything the dashboard shows comes from the API Gateway (port 8080).
// The browser never talks to the individual services directly - that is
// the whole point of having a gateway.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

// The gateway forwards each of these health URLs to the matching
// service's /actuator/health (see the "health proxies" in the gateway's
// application.yml). The gateway's own health is read directly.
const SERVICES = [
  { key: 'product', name: 'Product', host: 'product-service', port: 8081, url: `${API_BASE}/services/product/health` },
  { key: 'inventory', name: 'Inventory', host: 'inventory-service', port: 8082, url: `${API_BASE}/services/inventory/health` },
  {
    key: 'recommendation',
    name: 'Recommendation',
    host: 'recommendation-service',
    port: 8083,
    url: `${API_BASE}/services/recommendation/health`,
  },
  { key: 'gateway', name: 'Gateway', host: 'api-gateway', port: 8080, url: `${API_BASE}/actuator/health` },
]

const MAX_LOG_ROWS = 14
const THEME_ORDER = ['auto', 'light', 'dark']

// fetch() with a time limit, that never throws. Always returns an object
// saying whether it worked, what came back and how long it took. A page
// that can wait forever on a broken service would defeat the point of
// this project, so every call here gives up after timeoutMs.
async function timedFetch(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const start = performance.now()
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    let data = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    return { ok: res.ok, status: res.status, data, ms: Math.round(performance.now() - start) }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      ms: Math.round(performance.now() - start),
      error: err.name === 'AbortError' ? 'timeout' : 'network',
    }
  } finally {
    clearTimeout(timer)
  }
}

// Was this recommendation answer real, a fallback from the gateway, or an error?
//   live     -> a plain array of product ids, straight from recommendation-service
//   fallback -> {fallback: true, recommendations: [...]} made by the gateway
function classify(result) {
  if (!result.ok) return 'error'
  if (Array.isArray(result.data)) return 'live'
  if (result.data && result.data.fallback) return 'fallback'
  return 'error'
}

function itemsOf(result) {
  if (Array.isArray(result.data)) return result.data
  if (result.data && Array.isArray(result.data.recommendations)) return result.data.recommendations
  return []
}

function formatTime(date) {
  return date.toLocaleTimeString('en-IN', { hour12: false })
}

function rupees(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN')
}

const KIND_LABEL = { live: 'LIVE', fallback: 'FALLBACK', error: 'ERROR' }

function Badge({ kind, children }) {
  return <span className={`badge badge-${kind}`}>{children}</span>
}

// One switch on the breaker panel. state: up | mid | down | idle.
// Lever up = healthy, middle = answering with a fallback, down = not working.
const STATE_WORD = { up: 'HEALTHY', mid: 'FALLBACK', down: 'DOWN', idle: 'CHECKING' }

function Module({ name, host, port, state, word, rows, guard }) {
  return (
      <div className={`mod ${guard ? 'mod-guard' : ''}`}>
        <div className="mod-title">
          <h3>{name}</h3>
          <div className="mod-host mono">
            {host} :{port}
          </div>
        </div>
        <div className={`lever lever-${state}`} role="img" aria-label={`${name}: ${word || STATE_WORD[state]}`}>
          <i />
        </div>
        <div className="mod-read">
        <span className={`tag tag-${state}`}>
          <span className="lamp" aria-hidden="true" />
          {word || STATE_WORD[state]}
        </span>
          {rows.map(([label, value]) => (
              <span key={label}>
            {label} <b className="mono">{value}</b>
          </span>
          ))}
        </div>
      </div>
  )
}

export default function App() {
  const [health, setHealth] = useState({})
  const [products, setProducts] = useState([])
  const [stock, setStock] = useState({})
  const [catalogError, setCatalogError] = useState(false)

  const [selected, setSelected] = useState('P-101')
  const [rec, setRec] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [log, setLog] = useState([])
  const [counts, setCounts] = useState({ live: 0, fallback: 0, error: 0 })
  const [bursting, setBursting] = useState(false)

  const [chaos, setChaos] = useState(null)
  const [chaosError, setChaosError] = useState('')
  const [chaosBusy, setChaosBusy] = useState(false)

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('cb-theme')
      return saved === 'light' || saved === 'dark' ? saved : 'auto'
    } catch {
      return 'auto'
    }
  })

  // Refs let timers read the latest values without being re-created.
  const selectedRef = useRef(selected)
  const inFlight = useRef(false)

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  // ---- Theme: auto follows the device, light / dark are the viewer's choice ----
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      if (theme === 'auto') localStorage.removeItem('cb-theme')
      else localStorage.setItem('cb-theme', theme)
    } catch {
      // storage can be blocked; the theme still works for this visit
    }
  }, [theme])

  function nextTheme() {
    setTheme((t) => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length])
  }

  // ---- Service health: check all four every 3 seconds ----
  const checkHealth = useCallback(async () => {
    const results = await Promise.all(
        SERVICES.map(async (svc) => {
          const r = await timedFetch(svc.url, {}, 2500)
          const up = r.ok && r.data && r.data.status === 'UP'
          return [svc.key, { status: up ? 'UP' : 'DOWN', ms: r.ms }]
        }),
    )
    setHealth(Object.fromEntries(results))
  }, [])

  useEffect(() => {
    checkHealth()
    const id = setInterval(checkHealth, 3000)
    return () => clearInterval(id)
  }, [checkHealth])

  // ---- Catalog: products + stock (these keep working when the
  //      recommendation service is down - that is what we want to show) ----
  const loadCatalog = useCallback(async () => {
    const [p, s] = await Promise.all([
      timedFetch(`${API_BASE}/api/products`, {}, 4000),
      timedFetch(`${API_BASE}/api/inventory`, {}, 4000),
    ])
    if (p.ok && Array.isArray(p.data)) setProducts(p.data)
    if (s.ok && s.data) setStock(s.data)
    setCatalogError(!(p.ok && s.ok))
  }, [])

  useEffect(() => {
    loadCatalog()
    const id = setInterval(loadCatalog, 5000)
    return () => clearInterval(id)
  }, [loadCatalog])

  // ---- Chaos switch status ----
  const loadChaos = useCallback(async () => {
    const r = await timedFetch(`${API_BASE}/chaos`, {}, 3000)
    if (r.ok && r.data) {
      setChaos(r.data)
      setChaosError('')
    } else {
      setChaos(null)
      setChaosError('Cannot reach the recommendation service, so its chaos switch is unavailable.')
    }
  }, [])

  useEffect(() => {
    loadChaos()
    const id = setInterval(loadChaos, 5000)
    return () => clearInterval(id)
  }, [loadChaos])

  async function changeChaos(mode) {
    setChaosBusy(true)
    const r = await timedFetch(`${API_BASE}/chaos?mode=${mode}&delayMs=4000`, { method: 'POST' }, 4000)
    if (r.ok && r.data) {
      setChaos(r.data)
      setChaosError('')
    } else {
      setChaosError('Could not change chaos mode. Is the recommendation service running?')
    }
    setChaosBusy(false)
  }

  // ---- Recommendations: ask the gateway, record what came back ----
  const fetchRecommendation = useCallback(async (productId) => {
    const r = await timedFetch(`${API_BASE}/api/recommendations/${productId}`, {}, 8000)
    const kind = classify(r)
    const now = new Date()

    if (productId === selectedRef.current) {
      setRec({
        kind,
        items: itemsOf(r),
        message: r.data && r.data.message ? r.data.message : '',
        ms: r.ms,
        at: now,
      })
    }
    setCounts((c) => ({ ...c, [kind]: c[kind] + 1 }))
    setLog((rows) =>
        [{ id: now.getTime() + Math.random(), at: now, product: productId, kind, ms: r.ms, status: r.status }, ...rows].slice(
            0,
            MAX_LOG_ROWS,
        ),
    )
    return kind
  }, [])

  // Automatically ask for recommendations every 2 seconds. If the
  // previous request is still waiting, skip this tick instead of piling up.
  useEffect(() => {
    if (!autoRefresh) return undefined
    async function tick() {
      if (inFlight.current) return
      inFlight.current = true
      await fetchRecommendation(selectedRef.current)
      inFlight.current = false
    }
    tick()
    const id = setInterval(tick, 2000)
    return () => clearInterval(id)
  }, [autoRefresh, selected, fetchRecommendation])

  // Fire many requests at once, like a rush of shoppers, so the breaker
  // sees enough failures to trip quickly.
  async function sendBurst() {
    setBursting(true)
    await Promise.all(Array.from({ length: 12 }, () => fetchRecommendation(selectedRef.current)))
    setBursting(false)
  }

  function resetLog() {
    setLog([])
    setCounts({ live: 0, fallback: 0, error: 0 })
  }

  function nameOf(id) {
    const p = products.find((x) => x.id === id)
    return p ? p.name : id
  }

  const gatewayUp = health.gateway && health.gateway.status === 'UP'
  const recDown = health.recommendation && health.recommendation.status === 'DOWN'
  const selectedProduct = products.find((p) => p.id === selected)
  const totalCalls = counts.live + counts.fallback + counts.error

  // The headline tells the story in one sentence, based on what is happening now.
  let headline = 'All services healthy'
  let subline = 'Every request goes through the gateway. Recommendations are live.'
  if (health.gateway && !gatewayUp) {
    headline = 'The gateway is unreachable'
    subline = 'Start api-gateway in IntelliJ and wait a few seconds. This page reconnects by itself.'
  } else if (rec && rec.kind === 'fallback') {
    headline = recDown ? 'Recommendation service is down. The store keeps selling.' : 'Fallback mode. The store keeps selling.'
    subline = 'Shoppers see Top Sellers instead of personal picks. Products and stock are not affected.'
  } else if (recDown) {
    headline = 'Recommendation service is down'
    subline = 'The next request will show whether the gateway has switched to the fallback.'
  } else if (chaos && chaos.mode !== 'normal') {
    headline = 'Recommendations are under stress'
    subline = 'The breaker is judging the last 10 calls. At 50% failures or slow calls, it opens.'
  }

  // Panel state for each service.
  function moduleState(svc) {
    const h = health[svc.key]
    if (!h) return { state: 'idle', word: undefined, rows: [['Health check', '...']] }
    if (h.status === 'DOWN') return { state: 'down', word: undefined, rows: [['Health check', `${h.ms} ms`]] }
    if (svc.key === 'recommendation' && rec) {
      if (rec.kind === 'fallback') return { state: 'mid', word: 'FALLBACK', rows: [['Last answer', `${rec.ms} ms`]] }
      if (rec.kind === 'error') return { state: 'down', word: 'NO ANSWER', rows: [['Last answer', `${rec.ms} ms`]] }
      return { state: 'up', word: 'LIVE', rows: [['Last answer', `${rec.ms} ms`]] }
    }
    return { state: 'up', word: undefined, rows: [['Health check', `${h.ms} ms`]] }
  }

  const MODES = [
    { key: 'normal', label: 'Normal' },
    { key: 'slow', label: 'Slow (4 s)' },
    { key: 'fail', label: 'Fail (500)' },
  ]

  return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <b>CircuitBreaker</b>
            <span>Console</span>
          </div>
          <div className="chips">
          <span className="chip">
            <span className={`lamp ${gatewayUp ? 'lamp-up' : health.gateway ? 'lamp-down' : 'lamp-idle'}`} aria-hidden="true" />
            {gatewayUp ? 'Gateway online' : health.gateway ? 'Gateway unreachable' : 'Connecting'}
          </span>
            <button className="chip chip-btn" onClick={nextTheme} aria-label={`Theme: ${theme}. Press to change.`}>
              Theme: {theme === 'auto' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}
            </button>
          </div>
        </header>

        <section className="headline" aria-live="polite">
          <h1>{headline}</h1>
          <p>{subline}</p>
        </section>

        {/* ---------------- Breaker panel: service health ---------------- */}
        <section className="board" aria-label="Service health">
          <div className="board-head">
            <h2>Breaker panel</h2>
            <span>Lever up: healthy. Middle: fallback. Down: not working.</span>
          </div>
          <div className="mods">
            {SERVICES.map((svc) => {
              const m = moduleState(svc)
              return (
                  <Module
                      key={svc.key}
                      name={svc.name}
                      host={svc.host}
                      port={svc.port}
                      state={m.state}
                      word={m.word}
                      rows={m.rows}
                      guard={svc.key === 'recommendation'}
                  />
              )
            })}
          </div>
        </section>

        <div className="row">
          {/* ---------------- Chaos control ---------------- */}
          <section className="card">
            <h2>Break something on purpose</h2>
            <p className="sub">Change how the Recommendation service behaves. No restart needed.</p>
            <div className="seg" role="group" aria-label="Chaos mode">
              {MODES.map((m) => (
                  <button
                      key={m.key}
                      disabled={chaosBusy || !chaos}
                      aria-pressed={chaos ? chaos.mode === m.key : false}
                      onClick={() => changeChaos(m.key)}
                  >
                    {m.label}
                  </button>
              ))}
            </div>
            <p className="sub">
              Current mode: <b>{chaos ? chaos.mode : 'unknown'}</b>
            </p>
            {chaosError && <p className="error-text">{chaosError}</p>}
            <div className="actions">
              <button className="btn btn-main" onClick={sendBurst} disabled={bursting}>
                {bursting ? 'Sending...' : 'Send 12 at once'}
              </button>
              <label className="toggle">
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                Auto-refresh every 2 s
              </label>
            </div>
            <p className="foot">
              Try it: choose Fail, press Send 12 at once, then choose Normal and wait about 10 seconds. You can also stop the
              Recommendation service in IntelliJ.
            </p>
          </section>

          {/* ---------------- Request log ---------------- */}
          <section className="card">
            <div className="card-head">
              <h2>Live requests</h2>
              <button className="btn btn-quiet" onClick={resetLog}>
                Clear
              </button>
            </div>
            <div className="counts">
              <div className="count">
                <b>{counts.live}</b>
                <span>Live</span>
              </div>
              <div className="count">
                <b>{counts.fallback}</b>
                <span>Fallback</span>
              </div>
              <div className="count">
                <b>{counts.error}</b>
                <span>Error</span>
              </div>
              <div className="count">
                <b>{totalCalls}</b>
                <span>Total</span>
              </div>
            </div>
            <ul className="log">
              {log.length === 0 && <li className="empty">No requests yet. Pick a product or press Send 12 at once.</li>}
              {log.map((row) => (
                  <li key={row.id}>
                    <span className="mono dim">{formatTime(row.at)}</span>
                    <span className="mono">{row.product}</span>
                    <Badge kind={row.kind}>{KIND_LABEL[row.kind]}</Badge>
                    <span className="mono dim ms">{row.ms} ms</span>
                  </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ---------------- Storefront preview ---------------- */}
        <section className="card">
          <h2>What the shopper sees</h2>
          <p className="sub">Pick a product to load its recommendations.</p>

          {catalogError && (
              <p className="error-text">The catalog is not responding. Check that product-service and inventory-service are running.</p>
          )}

          <div className="shop">
            {products.length === 0 && !catalogError && <p className="sub">Loading products...</p>}
            {products.map((p) => {
              const qty = stock[p.id]
              return (
                  <button key={p.id} className="prod" aria-pressed={p.id === selected} onClick={() => setSelected(p.id)}>
                    <span className="cat">{p.category}</span>
                    <span className="n">{p.name}</span>
                    <span className="p mono">{rupees(p.price)}</span>
                    <span className={`stock ${qty === 0 ? 'out' : ''}`}>
                  {qty === undefined ? 'Stock unknown' : qty === 0 ? 'Out of stock' : `${qty} in stock`}
                </span>
                  </button>
              )
            })}
          </div>

          <div className="rec">
            <div className="rec-top">
              <h3>You may also like{selectedProduct ? `, with ${selectedProduct.name}` : ''}</h3>
              {rec && <Badge kind={rec.kind}>{rec.kind === 'fallback' ? 'TOP SELLERS' : KIND_LABEL[rec.kind]}</Badge>}
              {rec && <span className="sub mono">{rec.ms} ms</span>}
            </div>

            {!rec && <p className="sub">Waiting for the first answer...</p>}

            {rec && rec.kind !== 'error' && (
                <div className="rchips">
                  {rec.items.map((id) => (
                      <span key={id} className="rchip">
                  {nameOf(id)}
                </span>
                  ))}
                </div>
            )}

            {rec && rec.kind === 'fallback' && (
                <p className="sub">
                  {rec.message || 'The gateway served a safe fallback (Top Sellers) instead of waiting on the failing service.'}
                </p>
            )}
            {rec && rec.kind === 'error' && <p className="error-text">Could not get recommendations from the gateway at all.</p>}
          </div>
          <p className="foot">
            LIVE means the Recommendation service answered. FALLBACK means the gateway answered with Top Sellers because the
            service was slow, failing or the breaker was open.
          </p>
        </section>
      </div>
  )
}
