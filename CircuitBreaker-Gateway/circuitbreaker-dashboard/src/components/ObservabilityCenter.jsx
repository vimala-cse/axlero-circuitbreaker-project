import { useState } from 'react'
import {
  Activity,
  Clock,
  ExternalLink,
  RefreshCw,
  Server,
  Zap
} from 'lucide-react'

import {
  testLatency,
  getServiceHealth,
  ZIPKIN_URL
} from '../services/api'

const services = [
  { name: 'API Gateway', key: 'gateway' },
  { name: 'Product Service', key: 'product' },
  { name: 'Inventory Service', key: 'inventory' },
  { name: 'Recommendation Service', key: 'recommendation' }
]

export default function ObservabilityCenter() {
  const [seconds, setSeconds] = useState(3)
  const [latencyResult, setLatencyResult] = useState(null)
  const [loadingLatency, setLoadingLatency] = useState(false)
  const [health, setHealth] = useState({})
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [error, setError] = useState('')

  const runLatencyTest = async () => {
    setLoadingLatency(true)
    setError('')
    setLatencyResult(null)

    const start = performance.now()

    try {
      const response = await testLatency(seconds)
      const end = performance.now()

      setLatencyResult({
        success: true,
        response,
        duration: Math.round(end - start)
      })
    } catch (err) {
      const end = performance.now()

      setLatencyResult({
        success: false,
        response: err.message,
        duration: Math.round(end - start)
      })
      setError(err.message || 'Latency test failed')
    } finally {
      setLoadingLatency(false)
    }
  }

  const checkServiceHealth = async () => {
    setLoadingHealth(true)
    setError('')

    const results = {}

    await Promise.all(
      services.map(async (service) => {
        try {
          const result = await getServiceHealth(service.key)
          results[service.key] = {
            status: result?.status || 'UNKNOWN',
            details: result
          }
        } catch (err) {
          results[service.key] = {
            status: 'DOWN',
            details: err.message
          }
        }
      })
    )

    setHealth(results)
    setLoadingHealth(false)
  }

  const openZipkin = () => {
    window.open(ZIPKIN_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="observability-page">
      <div className="observability-heading">
        <div>
          <h2>Observability &amp; Performance</h2>
          <p>
            Monitor service health, test API latency and inspect distributed
            traces using Zipkin.
          </p>
        </div>
      </div>

      <div className="observability-grid">
        <section className="observability-card">
          <div className="observability-card-title">
            <Clock size={22} />
            <h3>Latency Testing</h3>
          </div>

          <p>
            Send a delayed request to the Recommendation Service through
            the API Gateway.
          </p>

          <label htmlFor="latency-seconds">Delay duration</label>

          <select
            id="latency-seconds"
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
          >
            <option value={1}>1 second</option>
            <option value={2}>2 seconds</option>
            <option value={3}>3 seconds</option>
            <option value={4}>4 seconds</option>
            <option value={5}>5 seconds</option>
          </select>

          <button
            className="observability-primary-button"
            onClick={runLatencyTest}
            disabled={loadingLatency}
          >
            <Zap size={17} />
            {loadingLatency ? 'Testing...' : 'Run Latency Test'}
          </button>

          {latencyResult && (
            <div className="observability-result" aria-live="polite">
              <h4>
                {latencyResult.success ? 'Request Completed' : 'Request Failed'}
              </h4>
              <p>
                <strong>Measured response time:</strong>{' '}
                {latencyResult.duration} ms
              </p>
              <p>
                <strong>Response:</strong>{' '}
                {typeof latencyResult.response === 'string'
                  ? latencyResult.response
                  : JSON.stringify(latencyResult.response)}
              </p>
            </div>
          )}
        </section>

        <section className="observability-card">
          <div className="observability-card-title">
            <Activity size={22} />
            <h3>Distributed Tracing</h3>
          </div>

          <p>
            Zipkin displays traces and spans collected from your instrumented
            Spring Boot services.
          </p>

          <div className="observability-info">
            <span>Zipkin address</span>
            <strong>localhost:9411</strong>
          </div>

          <button
            className="observability-primary-button"
            onClick={openZipkin}
          >
            <ExternalLink size={17} />
            Open Zipkin Dashboard
          </button>

          <p className="observability-hint">
            Run a backend API request first, then open Zipkin and select
            Run Query to find the trace.
          </p>
        </section>

        <section className="observability-card observability-health-card">
          <div className="observability-card-title">
            <Server size={22} />
            <h3>Microservice Health</h3>
          </div>

          <p>Check whether your backend services are responding.</p>

          <button
            className="observability-primary-button"
            onClick={checkServiceHealth}
            disabled={loadingHealth}
          >
            <RefreshCw size={17} />
            {loadingHealth ? 'Checking...' : 'Check All Services'}
          </button>

          <div className="observability-service-list">
            {services.map((service) => {
              const result = health[service.key]
              const isUp = result?.status === 'UP'

              return (
                <div className="observability-service-row" key={service.key}>
                  <span>{service.name}</span>
                  <strong
                    className={
                      !result
                        ? 'observability-unknown'
                        : isUp
                          ? 'observability-up'
                          : 'observability-down'
                    }
                  >
                    {result ? result.status : 'NOT CHECKED'}
                  </strong>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {error && <p className="observability-error">{error}</p>}

      <section className="observability-instructions">
        <h3>Operations checklist</h3>
        <ol>
          <li>Start Zipkin on port 9411.</li>
          <li>Start Eureka Server on port 8761.</li>
          <li>Start Product, Inventory and Recommendation Services.</li>
          <li>Start API Gateway on port 8080.</li>
          <li>Start the React frontend.</li>
          <li>Run a latency test or open another API page.</li>
          <li>Open Zipkin and select Run Query to inspect available traces.</li>
          <li>Explore the Circuit Breaker, Rate Limiter and Bulkhead controls.</li>
        </ol>
      </section>
    </div>
  )
}
