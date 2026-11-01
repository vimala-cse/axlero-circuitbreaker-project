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
  simulateRecommendationDelay
} from './services/api'

import './App.css'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'recommendations', label: 'Recommendations', icon: Sparkles },
  { id: 'health', label: 'Service Health', icon: Activity },
  { id: 'circuit', label: 'Circuit Breaker', icon: ShieldCheck }
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

  useEffect(() => {
    loadDashboard()
    checkAllHealth()
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
    setMessage('Sending a simulated failure request...')

    try {
      await simulateRecommendationFailure()
      setMessage(
        'The service returned a normal response. Check your backend configuration.'
      )
      setMessageType('info')
    } catch (error) {
      setMessage(
        `Failure request received (HTTP ${error.status || 'error'}). ` +
        'Repeat the test to reach the configured Circuit Breaker threshold.'
      )
      setMessageType('error')
    } finally {
      setLoading(false)
      await loadRecommendationsAfterTest()
    }
  }

  async function loadRecommendationsAfterTest() {
    try {
      const data = await getRecommendations()
      const items = Array.isArray(data)
        ? data
        : data?.recommendations || []

      setRecommendations(items)
      setRecommendationMode(
        data?.status === 'FALLBACK' ? 'Fallback' : 'Normal'
      )
    } catch {
      setRecommendationMode('Unavailable')
    }
  }

  async function testMultipleFailures() {
    setLoading(true)
    setMessage('Sending 5 failure requests one by one...')

    let failedRequests = 0

    for (let i = 0; i < 5; i++) {
      try {
        await simulateRecommendationFailure()
      } catch {
        failedRequests++
      }
    }

    await loadRecommendationsAfterTest()

    setMessage(
      `${failedRequests} failure responses received. ` +
      'Now check whether the next recommendation request returns fallback data.'
    )
    setMessageType('info')
    setLoading(false)
  }

  async function testDelay() {
    setLoading(true)
    setMessage('Testing a 3-second recommendation delay...')

    try {
      await simulateRecommendationDelay(3)
      setMessage(
        'Delay request completed. Check the Gateway timeout and Circuit Breaker settings.'
      )
      setMessageType('success')
    } catch (error) {
      setMessage(
        `Delayed request failed or timed out: ${error.message}`
      )
      setMessageType('error')
    } finally {
      setLoading(false)
      await loadRecommendationsAfterTest()
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
          <p>Week 1 &amp; Week 2 · Mid Review</p>
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
            <p className="breadcrumb">CIRCUITBREAKER / {pageTitle.toUpperCase()}</p>
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
            loading={loading}
          />
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
  onRecommendations
}) {
  const services = Object.values(health)
  const online = services.filter(value => value === 'UP').length

  return (
    <>
      <section className="welcome-card">
        <div>
          <span className="eyebrow">SYSTEM OVERVIEW</span>
          <h2>Welcome to CircuitBreaker</h2>
          <p>
            Monitor your e-commerce microservices, explore products
            and test fault tolerance through the API Gateway.
          </p>
        </div>
        <div className="welcome-art">
          <ShieldCheck size={90} />
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
  const label = name.replace('recommendation', 'Recommendation')
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
            <div className="product-card" key={product.id ?? index}>
              <div className="product-art">
                <Package size={45} />
              </div>
              <div className="product-info">
                <span className="eyebrow">PRODUCT #{product.id ?? index + 1}</span>
                <h3>{product.name || product.productName || 'Product'}</h3>
                <p>{product.description || 'E-commerce product'}</p>
                <strong>
                  {product.price != null ? `₹${product.price}` : 'Price not provided'}
                </strong>
              </div>
            </div>
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
              <h3>{item.name || item.productName || 'Recommended Product'}</h3>
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
        <p><strong>UP:</strong> The service health endpoint responded successfully.</p>
        <p><strong>DOWN:</strong> The health endpoint could not be reached or reported an issue.</p>
      </div>
    </>
  )
}

function CircuitBreaker({
  mode,
  onFailure,
  onMultipleFailures,
  onDelay,
  loading
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Circuit Breaker Testing</h2>
          <p>Test Recommendation Service failures and fallback behavior</p>
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

      <div className="test-grid">
        <div className="content-card">
          <AlertTriangle size={25} />
          <h3>Single Failure Test</h3>
          <p>Send one simulated HTTP 500 response from Recommendation Service.</p>
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
          <p>Send five failure requests sequentially to test the configured threshold.</p>
          <button
            className="danger-button"
            onClick={onMultipleFailures}
            disabled={loading}
          >
            Run 5 Failure Requests
          </button>
        </div>

        <div className="content-card">
          <RefreshCw size={25} />
          <h3>Delay Test</h3>
          <p>Send a recommendation request with a three-second delay.</p>
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
          <li>Open the Recommendation Service while all applications are running.</li>
          <li>Use the normal recommendation endpoint first.</li>
          <li>Run the multiple failure test.</li>
          <li>Check the recommendation response again.</li>
          <li>Observe the fallback response and Gateway console output.</li>
          <li>Allow the configured open-state wait duration before testing recovery.</li>
        </ol>
        <p className="muted">
          The breaker uses a sliding window of four calls and a 50% failure
          threshold. The actual state is maintained by Resilience4j in the
          Gateway; this page does not yet read a live breaker-state metric.
        </p>
      </div>
    </>
  )
}

export default App
