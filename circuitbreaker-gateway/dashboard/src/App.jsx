import { useCallback, useEffect, useRef, useState } from 'react'

// Everything the dashboard shows comes from the API Gateway (port 8080).
// The browser never talks to the individual services directly - that is
// the whole point of having a gateway.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

// The gateway forwards each of these health URLs to the matching
// service's /actuator/health (see the "health proxies" in the gateway's
// application.yml). The gateway's own health is read directly.
const SERVICES = [
  { key: 'gateway', name: 'API Gateway', port: 8080, url: `${API_BASE}/actuator/health` },
  { key: 'product', name: 'Product Service', port: 8081, url: `${API_BASE}/services/product/health` },
  { key: 'inventory', name: 'Inventory Service', port: 8082, url: `${API_BASE}/services/inventory/health` },
  { key: 'recommendation', name: 'Recommendation Service', port: 8083, url: `${API_BASE}/services/recommendation/health` },
]

const MAX_LOG_ROWS = 14

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

  // Refs let timers read the latest values without being re-created.
  const selectedRef = useRef(selected)
  const inFlight = useRef(false)

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

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
  const selectedProduct = products.find((p) => p.id === selected)
  const totalCalls = counts.live + counts.fallback + counts.error

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>CircuitBreaker Dashboard</h1>
          <p className="subtitle">Cloud-native e-commerce API gateway: watch the site survive a failing service</p>
        </div>
        <div className={`gateway-pill ${gatewayUp ? 'pill-up' : 'pill-down'}`}>
          <span className="dot" />
          {gatewayUp ? 'Gateway online' : 'Gateway unreachable'}
        </div>
      </header>

      <main>
        {/* ---------------- Service health ---------------- */}
        <section className="panel">
          <h2>Service health</h2>
          <div className="health-grid">
            {SERVICES.map((svc) => {
              const h = health[svc.key]
              const status = h ? h.status : 'CHECKING'
              return (
                <div key={svc.key} className={`health-card health-${status.toLowerCase()}`}>
                  <div className="health-name">{svc.name}</div>
                  <div className="health-port">port {svc.port}</div>
                  <div className="health-row">
                    <Badge kind={status === 'UP' ? 'live' : status === 'DOWN' ? 'error' : 'idle'}>{status}</Badge>
                    <span className="muted">{h ? `${h.ms} ms` : '...'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <div className="two-col">
          {/* ---------------- Chaos control ---------------- */}
          <section className="panel">
            <h2>Chaos control</h2>
            <p className="hint">
              Break the Recommendation service on purpose, then watch the gateway protect the rest of the site.
            </p>
            <div className="chaos-current">
              Current mode:{' '}
              {chaos ? (
                <strong className={`mode mode-${chaos.mode}`}>{chaos.mode.toUpperCase()}</strong>
              ) : (
                <strong className="mode mode-unknown">UNKNOWN</strong>
              )}
            </div>
            <div className="button-row">
              <button className="btn btn-ok" disabled={chaosBusy} onClick={() => changeChaos('normal')}>
                Normal
              </button>
              <button className="btn btn-warn" disabled={chaosBusy} onClick={() => changeChaos('slow')}>
                Slow (4 s delay)
              </button>
              <button className="btn btn-bad" disabled={chaosBusy} onClick={() => changeChaos('fail')}>
                Fail (HTTP 500)
              </button>
            </div>
            {chaosError && <p className="error-text">{chaosError}</p>}
            <p className="hint small">
              Tip: you can also stop the Recommendation service in IntelliJ. The storefront below should keep working
              either way.
            </p>
          </section>

          {/* ---------------- Request log ---------------- */}
          <section className="panel">
            <div className="panel-head">
              <h2>Recommendation requests</h2>
              <div className="button-row tight">
                <button className="btn btn-ghost" onClick={sendBurst} disabled={bursting}>
                  {bursting ? 'Sending...' : 'Send 12 at once'}
                </button>
                <button className="btn btn-ghost" onClick={resetLog}>
                  Clear
                </button>
              </div>
            </div>
            <div className="counts">
              <div className="count count-live">
                <span className="count-num">{counts.live}</span>
                <span className="count-label">live</span>
              </div>
              <div className="count count-fallback">
                <span className="count-num">{counts.fallback}</span>
                <span className="count-label">fallback</span>
              </div>
              <div className="count count-error">
                <span className="count-num">{counts.error}</span>
                <span className="count-label">error</span>
              </div>
              <div className="count">
                <span className="count-num">{totalCalls}</span>
                <span className="count-label">total</span>
              </div>
            </div>
            <ul className="log">
              {log.length === 0 && <li className="muted">No requests yet.</li>}
              {log.map((row) => (
                <li key={row.id} className="log-row">
                  <span className="muted mono">{formatTime(row.at)}</span>
                  <span className="mono">{row.product}</span>
                  <Badge kind={row.kind}>{KIND_LABEL[row.kind]}</Badge>
                  <span className="mono log-ms">{row.ms} ms</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ---------------- Storefront preview ---------------- */}
        <section className="panel">
          <div className="panel-head">
            <h2>Storefront preview</h2>
            <label className="toggle">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh recommendations
            </label>
          </div>

          {catalogError && (
            <p className="error-text">The catalog is not responding. Check that product-service and inventory-service are running.</p>
          )}

          <div className="product-grid">
            {products.length === 0 && !catalogError && <p className="muted">Loading products...</p>}
            {products.map((p) => {
              const qty = stock[p.id]
              return (
                <button
                  key={p.id}
                  className={`product-card ${p.id === selected ? 'product-selected' : ''}`}
                  onClick={() => setSelected(p.id)}
                >
                  <span className="product-cat">{p.category}</span>
                  <span className="product-name">{p.name}</span>
                  <span className="product-price">{rupees(p.price)}</span>
                  <span className={`stock ${qty === 0 ? 'stock-out' : ''}`}>
                    {qty === undefined ? 'stock unknown' : qty === 0 ? 'Out of stock' : `${qty} in stock`}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="rec-box">
            <div className="rec-head">
              <h3>You may also like{selectedProduct ? ` (with ${selectedProduct.name})` : ''}</h3>
              {rec && <Badge kind={rec.kind}>{KIND_LABEL[rec.kind]}</Badge>}
              {rec && <span className="muted mono">{rec.ms} ms</span>}
            </div>

            {!rec && <p className="muted">Waiting for the first answer...</p>}

            {rec && rec.kind !== 'error' && (
              <div className="chips">
                {rec.items.map((id) => (
                  <span key={id} className="chip">
                    {nameOf(id)}
                  </span>
                ))}
              </div>
            )}

            {rec && rec.kind === 'fallback' && (
              <p className="hint">
                {rec.message || 'The gateway served a safe fallback (Top Sellers) instead of waiting on the failing service.'}
              </p>
            )}
            {rec && rec.kind === 'error' && (
              <p className="error-text">Could not get recommendations from the gateway at all.</p>
            )}

            <p className="hint small">
              <strong>LIVE</strong> = answered by the Recommendation service. <strong>FALLBACK</strong> = the gateway
              answered with Top Sellers because the service was slow, failing or the breaker was open.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
