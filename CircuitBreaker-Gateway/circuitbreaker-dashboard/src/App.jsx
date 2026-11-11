
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Package,
  Boxes,
  Sparkles,
  Activity,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Menu,
  X,
  Server
} from 'lucide-react'

import {
  getProducts,
  getInventory,
  getRecommendations,
  getServiceHealth,
  simulateRecommendationFailure,
  simulateRecommendationDelay,
  testBulkhead,
  testTimeLimiter,
  getCircuitBreakerState
} from './services/api'

import laptopImage from './assets/laptop.jpg'
import smartphoneImage from './assets/smartphone.jpg'
import headphonesImage from './assets/headphones.jpg'
import ObservabilityCenter from './components/ObservabilityCenter'

import './App.css'

function getFallbackProductImage(product, index) {
  const name = `${product.name || product.productName || ''}`.toLowerCase()

  if (/laptop|notebook|computer|macbook/.test(name)) {
    return laptopImage
  }

  if (/headphone|earbud|audio|speaker/.test(name)) {
    return headphonesImage
  }

  if (/phone|mobile|smartphone/.test(name)) {
    return smartphoneImage
  }

  return [laptopImage, smartphoneImage, headphonesImage][index % 3]
}

function getProductImage(product, index) {
  const image = product.imageUrl || product.image || product.thumbnail
  return typeof image === 'string' && image.trim()
    ? image
    : getFallbackProductImage(product, index)
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'recommendations', label: 'Recommendations', icon: Sparkles },
  { id: 'health', label: 'Service Health', icon: Activity },
  { id: 'circuit', label: 'Circuit Breaker', icon: ShieldCheck },
  { id: 'observability', label: 'Observability', icon: Activity }
]

function App() {
  const [page, setPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [products, setProducts] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [inventory, setInventory] = useState(null)

  const [health, setHealth] = useState({
    product: 'Checking',
    inventory: 'Checking',
    recommendation: 'Checking',
    gateway: 'Checking'
  })

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('info')
  const [recommendationMode, setRecommendationMode] = useState('Unknown')

  const [selectedProduct, setSelectedProduct] = useState('1')

  const [resilienceResults, setResilienceResults] = useState(null)
  const [circuitState, setCircuitState] = useState(null)

  useEffect(() => {
    loadDashboard()
    checkAllHealth()
    refreshCircuitState()
    const stateTimer = window.setInterval(refreshCircuitState, 2000)
    return () => window.clearInterval(stateTimer)
    // Initial dashboard load and polling are intentionally mounted once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadDashboard() {
    setLoading(true)
    setMessage('')

    try {
      const productData = await getProducts()
      setProducts(Array.isArray(productData) ? productData : [])

      await loadRecommendations()
    } catch (error) {
      setMessage(error.message || 'Unable to load dashboard data')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  async function loadRecommendations() {
    try {
      const data = await getRecommendations()

      const items = Array.isArray(data)
        ? data
        : data?.recommendations || []

      setRecommendations(items)
      setRecommendationMode(
        data?.status === 'FALLBACK' ? 'Fallback' : 'Normal'
      )
    } catch (error) {
      setRecommendations([])
      setRecommendationMode('Unavailable')
      throw error
    }
  }

  async function refreshCircuitState() {
    try {
      const state = await getCircuitBreakerState()
      setCircuitState(state)
    } catch {
      setCircuitState(null)
    }
  }

  async function checkOneHealth(service) {
    try {
      const data = await getServiceHealth(service)
      return data?.status || 'UNKNOWN'
    } catch {
      return 'DOWN'
    }
  }

  async function checkAllHealth() {
    const services = ['product', 'inventory', 'recommendation', 'gateway']

    const results = await Promise.all(
      services.map(async service => [
        service,
        await checkOneHealth(service)
      ])
    )

    setHealth(Object.fromEntries(results))
  }

  async function checkInventory() {
    setLoading(true)
    setMessage('')

    try {
      const data = await getInventory(selectedProduct)
      setInventory(data)
      setMessage('Inventory information loaded successfully.')
      setMessageType('success')
    } catch (error) {
      setInventory(null)
      setMessage(error.message || 'Unable to load inventory')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  async function testFailure() {
    setLoading(true)
    setMessage('Sending one simulated HTTP 500 request...')
    try {
      const response = await simulateRecommendationFailure()
      if (response?.status === 'FALLBACK') {
        setMessage('Single failure detected: the Gateway returned fallback data. One failure alone should not open the breaker.')
        setMessageType('success')
      } else {
        setMessage('The request completed without a fallback response. Review the Gateway Circuit Breaker route.')
        setMessageType('info')
      }
    } catch (error) {
      setMessage(`Single failure request returned HTTP ${error.status || 'ERROR'}: ${error.message}`)
      setMessageType('error')
    } finally {
      await refreshCircuitState()
      await loadRecommendationsAfterTest()
      setLoading(false)
    }
  }

  async function loadRecommendationsAfterTest() {
    try {
      const data = await getRecommendations()
      const items = Array.isArray(data) ? data : data?.recommendations || []
      setRecommendations(items)
      setRecommendationMode(data?.status === 'FALLBACK' ? 'Fallback' : 'Normal')
    } catch {
      setRecommendationMode('Unavailable')
    }
  }

  async function testMultipleFailures() {
    setLoading(true)
    setMessage('Sending four simulated HTTP 500 requests to reach the configured breaker window...')
    const outcomes = []
    try {
      for (let i = 0; i < 4; i++) {
        try {
          const response = await simulateRecommendationFailure()
          outcomes.push(response?.status === 'FALLBACK' ? 'FALLBACK' : 'UNEXPECTED_RESPONSE')
        } catch (error) {
          outcomes.push(`HTTP_${error.status || 'ERROR'}`)
        }
      }
      await refreshCircuitState()
      const state = await getCircuitBreakerState()
      setCircuitState(state)
      const fallbackCount = outcomes.filter(value => value === 'FALLBACK').length
      setMessage(`${fallbackCount}/4 requests returned Gateway fallback. Circuit Breaker state: ${state.state}. If it is OPEN, wait 10 seconds for HALF_OPEN recovery.`)
      setMessageType(state.state === 'OPEN' ? 'success' : 'info')
      await loadRecommendationsAfterTest()
    } catch (error) {
      setMessage(`Multiple failure test could not complete: ${error.message}. Wait for the 10-second Gateway rate-limit window or Circuit Breaker recovery, then retry.`)
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  async function testDelay() {
    setLoading(true)
    setMessage('Sending four concurrent 3-second requests. This tests the Gateway slow-call threshold.')
    const started = performance.now()
    try {
      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () => simulateRecommendationDelay(3))
      )
      const elapsed = Math.round(performance.now() - started)
      const completed = results.filter(item => item.status === 'fulfilled').length
      await refreshCircuitState()
      const state = await getCircuitBreakerState()
      setCircuitState(state)
      setMessage(`Delay test finished in ${elapsed} ms. ${completed}/4 requests completed. Circuit Breaker state: ${state.state}. The slow-call threshold is 2 seconds; allow recovery before running another test.`)
      setMessageType(state.state === 'OPEN' ? 'success' : 'info')
    } catch (error) {
      setMessage(`Delay test failed: ${error.message}`)
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  async function runRateLimiterTest() {
    setLoading(true)
    setMessage('Sending 6 simultaneous recommendation requests...')

    setResilienceResults(null)

    try {
      const results = await Promise.allSettled(
        Array.from(
          { length: 6 },
          () => getRecommendations()
        )
      )

      const summary = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return {
            request: index + 1,
            status: 'SUCCESS',
            details: 'Request accepted'
          }
        }

        const error = result.reason

        return {
          request: index + 1,
          status: error?.status === 429 ? 'BLOCKED' : 'FAILED',
          details: error?.status
            ? `HTTP ${error.status}`
            : error?.message || 'Request failed'
        }
      })

      setResilienceResults({
        title: 'Rate Limiter Results',
        results: summary
      })

      const blocked = summary.filter(
        item => item.status === 'BLOCKED'
      ).length

      setMessage(
        `${summary.length} requests completed. ${blocked} request(s) were blocked.`
      )
      setMessageType(blocked > 0 ? 'success' : 'info')
    } catch (error) {
      setMessage(error.message || 'Rate Limiter test failed')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  async function runBulkheadTest() {
    setLoading(true)
    setMessage('Sending 3 simultaneous Bulkhead requests...')

    setResilienceResults(null)

    try {
      const results = await Promise.allSettled([
        testBulkhead(5),
        testBulkhead(5),
        testBulkhead(5)
      ])

      const summary = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return {
            request: index + 1,
            status: Array.isArray(result.value) && result.value.some(item => String(item.name || '').includes('Fallback')) ? 'FALLBACK' : 'SUCCESS',
            details: JSON.stringify(result.value)
          }
        }

        const error = result.reason

        return {
          request: index + 1,
          status: 'FAILED',
          details: error?.message || 'Request failed'
        }
      })

      setResilienceResults({
        title: 'Bulkhead Results',
        results: summary
      })

      const successful = summary.filter(
        item => item.status === 'SUCCESS'
      ).length

      setMessage(
        `${successful} of 3 Bulkhead requests completed successfully.`
      )
      setMessageType('info')
    } catch (error) {
      setMessage(error.message || 'Bulkhead test failed')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  async function runTimeLimiterTest() {
    setLoading(true)
    setMessage('Testing the Time Limiter with a 4-second request...')

    setResilienceResults(null)

    try {
      const result = await testTimeLimiter(4)

      setResilienceResults({
        title: 'Time Limiter Results',
        results: [
          {
            request: 1,
            status: Array.isArray(result) && result.some(item => String(item.name || '').includes('Fallback')) ? 'FALLBACK' : 'SUCCESS',
            details: JSON.stringify(result)
          }
        ]
      })

      setMessage('Time Limiter request completed. Check the returned response.')
      setMessageType('success')
    } catch (error) {
      setResilienceResults({
        title: 'Time Limiter Results',
        results: [
          {
            request: 1,
            status: 'TIMEOUT / FAILED',
            details: error.message || 'Request timed out'
          }
        ]
      })

      setMessage(
        `Time Limiter request failed or timed out: ${error.message}`
      )
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  function navigate(id) {
    setPage(id)
    setSidebarOpen(false)
    setMessage('')
  }

  const pageTitle =
    menuItems.find(item => item.id === page)?.label || 'Dashboard'

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-icon">
            <ShieldCheck size={25} />
          </div>

          <div>
            <h2>CircuitBreaker</h2>
            <span>Cloud API Gateway</span>
          </div>

          <button
            className="close-sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <p className="menu-heading">MAIN MENU</p>

        <nav>
          {menuItems.map(item => {
            const Icon = item.icon

            return (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => navigate(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="backend-label">
            <span className="online-dot" />
            Backend connection
            <strong>Gateway : 8080</strong>
          </div>

          <p>Resilience · Monitoring · Insights</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div>
            <p className="breadcrumb">
              CIRCUITBREAKER / {pageTitle.toUpperCase()}
            </p>
            <h1>{pageTitle}</h1>
          </div>

          <button
            className="refresh-button"
            onClick={() => {
              loadDashboard()
              checkAllHealth()
            }}
            disabled={loading}
          >
            <RefreshCw size={17} />
            <span>Refresh</span>
          </button>
        </header>

        {message && (
          <div className={`notice ${messageType}`}>
            <AlertTriangle size={18} />
            {message}
          </div>
        )}

        {page === 'dashboard' && (
          <Dashboard
            products={products}
            recommendations={recommendations}
            health={health}
            recommendationMode={recommendationMode}
            onProducts={() => navigate('products')}
            onRecommendations={() => navigate('recommendations')}
            onCircuit={() => navigate('circuit')}
          />
        )}

        {page === 'products' && (
          <Products products={products} />
        )}

        {page === 'inventory' && (
          <Inventory
            selectedProduct={selectedProduct}
            setSelectedProduct={setSelectedProduct}
            inventory={inventory}
            onCheck={checkInventory}
            loading={loading}
          />
        )}

        {page === 'recommendations' && (
          <Recommendations
            recommendations={recommendations}
            mode={recommendationMode}
            onRefresh={loadRecommendations}
          />
        )}

        {page === 'health' && (
          <Health
            health={health}
            onRefresh={checkAllHealth}
          />
        )}

        {page === 'circuit' && (
          <CircuitBreaker
            mode={recommendationMode}
            onFailure={testFailure}
            onMultipleFailures={testMultipleFailures}
            onDelay={testDelay}
            onRateLimit={runRateLimiterTest}
            onBulkhead={runBulkheadTest}
            onTimeLimiter={runTimeLimiterTest}
            resilienceResults={resilienceResults}
            circuitState={circuitState}
            onRefreshCircuitState={refreshCircuitState}
            loading={loading}
          />
        )}

        {page === 'observability' && (
          <ObservabilityCenter />
        )}

        <footer>
          CircuitBreaker · Cloud-Native E-Commerce API Gateway
          <span>React + Spring Boot + Spring Cloud + Resilience4j</span>
        </footer>
      </main>
    </div>
  )
}

function Dashboard({
  products,
  recommendations,
  health,
  recommendationMode,
  onProducts,
  onRecommendations,
  onCircuit
}) {
  const services = Object.values(health)
  const online = services.filter(value => value === 'UP').length

  return (
    <>
      <section className="welcome-card">
        <div>
          <span className="eyebrow">CLOUD PLATFORM / LIVE CONTROL PLANE</span>
          <h2>Your services, at a glance.</h2>
          <p>
            Explore your service landscape, inspect commerce data and validate
            resilience — all from one command center.
          </p>
          <span className="hero-status"><span className="online-dot" /> LIVE SYSTEM OVERVIEW</span>
        </div>

        <div className="welcome-art">
          <img
            className="hero-photo"
            src={laptopImage}
            alt="Laptop on a bright desk"
          />
          <span className="hero-photo-caption">
            <span className="online-dot" />
            Commerce services, in sync
          </span>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          icon={<Package />}
          label="Total Products"
          value={products.length}
          color="purple"
        />

        <StatCard
          icon={<Server />}
          label="Services Online"
          value={`${online} / 4`}
          color="green"
        />

        <StatCard
          icon={<Sparkles />}
          label="Recommendations"
          value={recommendations.length}
          color="orange"
        />

        <StatCard
          icon={<ShieldCheck />}
          label="Recommendation Mode"
          value={recommendationMode}
          color="blue"
        />
      </section>

      <div className="section-heading">
        <div>
          <h2>Microservice Overview</h2>
          <p>Current health reported by Spring Boot Actuator</p>
        </div>
      </div>

      <div className="health-grid">
        {Object.entries(health).map(([name, status]) => (
          <HealthCard key={name} name={name} status={status} />
        ))}
      </div>

      <div className="quick-grid">
        <div className="content-card">
          <h3>Product Management</h3>
          <p>View the products received from Product Service.</p>

          <button className="primary-button" onClick={onProducts}>
            View Products
          </button>
        </div>

        <div className="content-card">
          <h3>Recommendations</h3>
          <p>Explore normal and fallback recommendation responses.</p>

          <button className="primary-button" onClick={onRecommendations}>
            View Recommendations
          </button>
        </div>

        <div className="content-card">
          <h3>Resilience Testing</h3>
          <p>Test Circuit Breaker, Rate Limiter, Bulkhead and Time Limiter.</p>

          <button className="primary-button" onClick={onCircuit}>
            Open Testing Dashboard
          </button>
        </div>
      </div>
    </>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>

      <div>
        <p>{label}</p>
        <h2>{value}</h2>
      </div>
    </div>
  )
}

function HealthCard({ name, status }) {
  const label = name
    .replace('recommendation', 'Recommendation')
    .replace('product', 'Product')
    .replace('inventory', 'Inventory')
    .replace('gateway', 'API Gateway')

  return (
    <div className="health-card">
      <div className="health-card-top">
        <Server size={20} />

        <span className={`status-pill ${status === 'UP' ? 'up' : 'down'}`}>
          {status}
        </span>
      </div>

      <h3>{label}</h3>
      <p>Spring Boot Service</p>
    </div>
  )
}

function Products({ products }) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Available Products</h2>
          <p>Data loaded from Product Service through API Gateway</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          No products found. Check whether Product Service is running.
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product, index) => (
            <article className="product-card" key={product.id ?? index}>
              <div className="product-art">
                <img
                  src={getProductImage(product, index)}
                  alt={product.name || product.productName || 'Product'}
                  loading="lazy"
                  onError={event => {
                    event.currentTarget.onerror = null
                    event.currentTarget.src = getFallbackProductImage(product, index)
                  }}
                />
                <span className="product-image-label">IN CATALOG</span>
              </div>

              <div className="product-info">
                <span className="eyebrow">
                  PRODUCT #{product.id ?? index + 1}
                </span>

                <h3>
                  {product.name || product.productName || 'Product'}
                </h3>

                <p>{product.description || 'E-commerce product'}</p>

                <strong>
                  {product.price != null
                    ? `₹${product.price}`
                    : 'Price not provided'}
                </strong>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

function Inventory({
  selectedProduct,
  setSelectedProduct,
  inventory,
  onCheck,
  loading
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Inventory Management</h2>
          <p>Check stock availability from Inventory Service</p>
        </div>
      </div>

      <div className="content-card inventory-panel">
        <label htmlFor="productId">Select Product ID</label>

        <select
          id="productId"
          value={selectedProduct}
          onChange={event => setSelectedProduct(event.target.value)}
        >
          <option value="1">Product 1 - Laptop</option>
          <option value="2">Product 2 - Mobile</option>
          <option value="3">Product 3 - Headphones</option>
        </select>

        <button
          className="primary-button"
          onClick={onCheck}
          disabled={loading}
        >
          {loading ? 'Checking...' : 'Check Inventory'}
        </button>

        {inventory && (
          <div className="inventory-result">
            <h3>Inventory Response</h3>
            <pre>{JSON.stringify(inventory, null, 2)}</pre>
          </div>
        )}
      </div>
    </>
  )
}

function Recommendations({ recommendations, mode, onRefresh }) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Product Recommendations</h2>
          <p>Recommendations from Recommendation Service</p>
        </div>

        <span className={`status-pill ${mode === 'Fallback' ? 'warning' : 'up'}`}>
          {mode}
        </span>
      </div>

      <div className="content-card">
        <p className="muted">
          Current response type: <strong>{mode}</strong>
        </p>

        <button className="primary-button" onClick={onRefresh}>
          <RefreshCw size={16} /> Load Recommendations
        </button>

        <div className="recommendation-grid">
          {recommendations.map((item, index) => (
            <div className="recommendation-card" key={item.id ?? index}>
              <Sparkles size={24} />

              <h3>
                {item.name || item.productName || 'Recommended Product'}
              </h3>

              <p>{item.reason || 'Recommended for customers'}</p>

              <span>Product ID: {item.id ?? 'N/A'}</span>
            </div>
          ))}
        </div>

        {recommendations.length === 0 && (
          <div className="empty-state">
            No recommendation data available. Try refreshing.
          </div>
        )}
      </div>
    </>
  )
}

function Health({ health, onRefresh }) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Service Health Monitoring</h2>
          <p>Health status from the Actuator health endpoints</p>
        </div>

        <button className="primary-button" onClick={onRefresh}>
          <RefreshCw size={16} /> Check Health
        </button>
      </div>

      <div className="health-grid large">
        {Object.entries(health).map(([name, status]) => (
          <HealthCard key={name} name={name} status={status} />
        ))}
      </div>

      <div className="content-card">
        <h3>Health Status Explanation</h3>

        <p>
          <strong>UP:</strong> The service health endpoint responded successfully.
        </p>

        <p>
          <strong>DOWN:</strong> The health endpoint could not be reached or reported an issue.
        </p>
      </div>
    </>
  )
}

function CircuitBreaker({
  mode,
  onFailure,
  onMultipleFailures,
  onDelay,
  onRateLimit,
  onBulkhead,
  onTimeLimiter,
  resilienceResults,
  circuitState,
  onRefreshCircuitState,
  loading
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Resilience Testing Dashboard</h2>
          <p>Test failure handling and resilience features of the API Gateway</p>
        </div>
      </div>

      <div className="circuit-banner">
        <ShieldCheck size={42} />

        <div>
          <span className="eyebrow">RECOMMENDATION RESPONSE</span>
          <h2>{mode}</h2>

          <p>
            This label describes the last successful recommendation response.
            It is not a direct reading of the internal breaker state.
          </p>
        </div>
      </div>

      <div className="breaker-state-card">
        <div>
          <span className="eyebrow">LIVE RESILIENCE4J STATE</span>
          <h2 className={`breaker-state ${String(circuitState?.state || 'UNKNOWN').toLowerCase()}`}>
            {circuitState?.state || 'UNKNOWN'}
          </h2>
          <p>Failure rate: {circuitState?.failureRate ?? 'N/A'}% · Slow-call rate: {circuitState?.slowCallRate ?? 'N/A'}%</p>
          <p>Failed calls: {circuitState?.numberOfFailedCalls ?? 0} · Successful calls: {circuitState?.numberOfSuccessfulCalls ?? 0} · Rejected calls: {circuitState?.numberOfNotPermittedCalls ?? 0}</p>
        </div>
        <button className="primary-button" onClick={onRefreshCircuitState} disabled={loading}>Refresh State</button>
      </div>

      <div className="section-heading">
        <div>
          <h2>Circuit Breaker</h2>
          <p>Test Recommendation Service failures and fallback behavior</p>
        </div>
      </div>

      <div className="test-grid">
        <div className="content-card">
          <AlertTriangle size={25} />

          <h3>Single Failure Test</h3>

          <p>
            Send one simulated HTTP 500 response from Recommendation Service.
          </p>

          <button
            className="danger-button"
            onClick={onFailure}
            disabled={loading}
          >
            Simulate Failure
          </button>
        </div>

        <div className="content-card">
          <Activity size={25} />

          <h3>Multiple Failure Test</h3>

          <p>
            Send four HTTP 500 requests sequentially. The Gateway breaker evaluates a four-call window.
          </p>

          <button
            className="danger-button"
            onClick={onMultipleFailures}
            disabled={loading}
          >
            Run 4 Failure Requests
          </button>
        </div>

        <div className="content-card">
          <RefreshCw size={25} />

          <h3>Delay Test</h3>

          <p>
            Send four concurrent three-second requests to test the slow-call threshold.
          </p>

          <button
            className="primary-button"
            onClick={onDelay}
            disabled={loading}
          >
            Test 3-Second Delay
          </button>
        </div>
      </div>

      <div className="content-card instructions">
        <h3>How to demonstrate Circuit Breaker</h3>

        <ol>
          <li>Start all backend applications.</li>
          <li>Open the Recommendation Service while all applications are running.</li>
          <li>Use the normal recommendation endpoint first.</li>
          <li>Run the multiple failure test.</li>
          <li>Check the recommendation response again.</li>
          <li>Observe the fallback response and Gateway console output.</li>
          <li>Allow the configured open-state wait duration before testing recovery.</li>
        </ol>

        <p className="muted">
          The breaker uses a four-call sliding window and a 50% failure threshold.
          The state above is read directly from the Gateway Resilience4j registry.
          Wait for the 10-second open-state period before testing recovery.
        </p>
      </div>

      <div className="section-heading">
        <div>
          <h2>Traffic &amp; Fault Isolation</h2>
          <p>Test Rate Limiter, Bulkhead and Time Limiter</p>
        </div>
      </div>

      <div className="test-grid">
        <div className="content-card">
          <Activity size={25} />

          <h3>Rate Limiter</h3>

          <p>
            Send six simultaneous recommendation requests.
            The configured limit is five requests per ten seconds.
          </p>

          <button
            className="primary-button"
            onClick={onRateLimit}
            disabled={loading}
          >
            Test Rate Limiter
          </button>
        </div>

        <div className="content-card">
          <Server size={25} />

          <h3>Bulkhead</h3>

          <p>
            Send three simultaneous requests.
            The configured maximum concurrent calls is two.
          </p>

          <button
            className="primary-button"
            onClick={onBulkhead}
            disabled={loading}
          >
            Test Bulkhead
          </button>
        </div>

        <div className="content-card">
          <RefreshCw size={25} />

          <h3>Time Limiter</h3>

          <p>
            Send a four-second request to test the configured two-second TimeLimiter timeout.
          </p>

          <button
            className="primary-button"
            onClick={onTimeLimiter}
            disabled={loading}
          >
            Test Time Limiter
          </button>
        </div>
      </div>

      {loading && (
        <div className="content-card">
          <p>Test running. Please wait for the backend response...</p>
        </div>
      )}

      {resilienceResults && (
        <div className="content-card">
          <h3>{resilienceResults.title}</h3>

          <div className="inventory-result">
            {resilienceResults.results.map((item, index) => (
              <div key={index}>
                <p>
                  <strong>Request {item.request}:</strong>{' '}
                  <span
                    className={
                      item.status === 'SUCCESS' || item.status === 'FALLBACK'
                        ? 'success-text'
                        : 'error-text'
                    }
                  >
                    {item.status}
                  </span>
                </p>

                <p>{item.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="content-card instructions">
        <h3>Resilience test runbook</h3>

        <ol>
          <li>Start Eureka Server and all three microservices.</li>
          <li>Start the API Gateway.</li>
          <li>Open this frontend dashboard.</li>
          <li>Click Test Rate Limiter and check for HTTP 429 responses.</li>
          <li>Wait at least ten seconds before running the next test.</li>
          <li>Click Test Bulkhead and observe the three concurrent requests.</li>
          <li>Click Test Time Limiter and observe whether the request times out.</li>
          <li>Check the Recommendation Service and Gateway console logs.</li>
        </ol>

        <p className="muted">
          Note: All recommendation routes share the configured Gateway rate
          limiter. Wait for its ten-second window to reset before testing
          Bulkhead or Time Limiter. Actual results depend on the backend
          configuration and service response.
        </p>
      </div>
    </>
  )
}

export default App
