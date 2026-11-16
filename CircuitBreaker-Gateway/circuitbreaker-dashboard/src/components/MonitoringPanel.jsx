import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  RefreshCw,
  Server,
  ShieldCheck
} from 'lucide-react'

import {
  getMonitoringOverview,
  getServiceHealth
} from '../services/api'

import './MonitoringPanel.css'

const services = [
  { key: 'gateway', label: 'API Gateway' },
  { key: 'product', label: 'Product Service' },
  { key: 'inventory', label: 'Inventory Service' },
  { key: 'recommendation', label: 'Recommendation Service' }
]

function formatNumber(value, digits = 1) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(digits) : 'N/A'
}

function MetricCard({ icon: Icon, label, value, suffix, description }) {
  return (
    <article className="monitor-metric-card">
      <div className="monitor-metric-icon">
        <Icon size={20} />
      </div>
      <div>
        <p>{label}</p>
        <h3>{value}{suffix || ''}</h3>
        <span>{description}</span>
      </div>
    </article>
  )
}

export default function MonitoringPanel() {
  const [overview, setOverview] = useState(null)
  const [health, setHealth] = useState({})
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  const refreshMonitoring = useCallback(async () => {
    try {
      const result = await getMonitoringOverview()
      setOverview(result)
      setError('')
      setLastUpdated(new Date())

      const latency = Number(result.averageResponseTimeMs)

      if (Number.isFinite(latency)) {
        setHistory(previous => [
          ...previous,
          {
            time: new Date().toLocaleTimeString(),
            latency
          }
        ].slice(-12))
      }
    } catch (err) {
      setError(err.message || 'Unable to load Gateway monitoring data')
    }

    const healthResults = await Promise.allSettled(
      services.map(service => getServiceHealth(service.key))
    )

    const updatedHealth = {}

    healthResults.forEach((result, index) => {
      const key = services[index].key

      updatedHealth[key] =
        result.status === 'fulfilled'
          ? result.value?.status || 'UNKNOWN'
          : 'DOWN'
    })

    setHealth(updatedHealth)
    setLoading(false)
  }, [])

  useEffect(() => {
    refreshMonitoring()

    const timer = window.setInterval(refreshMonitoring, 5000)

    return () => window.clearInterval(timer)
  }, [refreshMonitoring])

  const breaker = overview?.circuitBreaker
  const breakerState = breaker?.state || 'UNKNOWN'

  const maxLatency = Math.max(
    1,
    ...history.map(item => item.latency)
  )

  const onlineCount = Object.values(health)
  .filter(status => status === 'UP' || status === 'DEGRADED').length

  return (
    <section className="monitoring-panel">

      <div className="monitoring-header">
        <div>
          <span className="monitoring-eyebrow">
            SYSTEM OBSERVABILITY
          </span>
          <h2>Live Monitoring Overview</h2>
          <p>
            Gateway performance, service availability and resilience status.
          </p>
        </div>

        <button
          className="monitor-refresh-button"
          onClick={refreshMonitoring}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="monitor-error">
          <AlertTriangle size={17} />
          {error}
        </div>
      )}

      <div className="monitor-metrics-grid">
        <MetricCard
          icon={Activity}
          label="Total Requests"
          value={overview?.totalRequests ?? 'N/A'}
          description="Gateway HTTP requests"
        />

        <MetricCard
          icon={Clock}
          label="Average Response Time"
          value={formatNumber(overview?.averageResponseTimeMs)}
          suffix=" ms"
          description="Average recorded request duration"
        />

        <MetricCard
          icon={AlertTriangle}
          label="Error Rate"
          value={formatNumber(overview?.errorRatePercent, 2)}
          suffix="%"
          description={`${overview?.errorRequests ?? 0} HTTP 4xx/5xx responses`}
        />

        <MetricCard
          icon={Server}
          label="Services Online"
          value={`${onlineCount} / 4`}
          description="Latest health checks"
        />
      </div>

      <div className="monitoring-details-grid">

        <article className="monitor-card">
          <div className="monitor-card-heading">
            <ShieldCheck size={20} />
            <h3>Circuit Breaker Status</h3>
          </div>

          <div className={`monitor-breaker-state ${breakerState.toLowerCase()}`}>
            {breakerState}
          </div>

          <div className="monitor-detail-row">
            <span>Failure rate</span>
            <strong>{formatNumber(breaker?.failureRate, 1)}%</strong>
          </div>

          <div className="monitor-detail-row">
            <span>Slow-call rate</span>
            <strong>{formatNumber(breaker?.slowCallRate, 1)}%</strong>
          </div>

          <div className="monitor-detail-row">
            <span>Failed calls</span>
            <strong>{breaker?.failedCalls ?? 0}</strong>
          </div>

          <div className="monitor-detail-row">
            <span>Successful calls</span>
            <strong>{breaker?.successfulCalls ?? 0}</strong>
          </div>

          <div className="monitor-detail-row">
            <span>Rejected calls</span>
            <strong>{breaker?.rejectedCalls ?? 0}</strong>
          </div>
        </article>

        <article className="monitor-card">
          <div className="monitor-card-heading">
            <Cpu size={20} />
            <h3>Gateway Runtime</h3>
          </div>

          <div className="monitor-runtime-number">
            {overview?.gatewayUptimeSeconds ?? 0}
            <span> seconds uptime</span>
          </div>

          <p className="monitor-memory-label">
            JVM Heap Memory
          </p>

          <div className="monitor-memory-bar">
            <div
              style={{
                width: `${
                  overview?.jvmMemoryMaxMb > 0
                    ? Math.min(
                        100,
                        (overview.jvmMemoryUsedMb /
                          overview.jvmMemoryMaxMb) * 100
                      )
                    : 0
                }%`
              }}
            />
          </div>

          <div className="monitor-detail-row">
            <span>Used memory</span>
            <strong>{formatNumber(overview?.jvmMemoryUsedMb)} MB</strong>
          </div>

          <div className="monitor-detail-row">
            <span>Maximum heap</span>
            <strong>
              {overview?.jvmMemoryMaxMb > 0
                ? `${formatNumber(overview.jvmMemoryMaxMb)} MB`
                : 'Not available'}
            </strong>
          </div>
        </article>
      </div>

      <article className="monitor-card monitor-health-card">
        <div className="monitor-card-heading">
          <Server size={20} />
          <h3>Microservice Availability</h3>
        </div>

        <div className="monitor-service-grid">
          {services.map(service => {
            const status = health[service.key] || 'CHECKING'

            return (
              <div className="monitor-service" key={service.key}>
                <span>{service.label}</span>
                <strong className={`monitor-health-status ${status.toLowerCase()}`}>
                  {status}
                </strong>
              </div>
            )
          })}
        </div>
      </article>

      <article className="monitor-card">
        <div className="monitor-card-heading">
          <Activity size={20} />
          <h3>Response Time Trend</h3>
        </div>

        <p className="monitor-chart-description">
          Average Gateway response time from the last 12 dashboard readings.
        </p>

        {history.length === 0 ? (
          <p className="monitor-empty">
            Waiting for monitoring readings...
          </p>
        ) : (
          <div className="monitor-chart">
            {history.map((item, index) => (
              <div className="monitor-chart-column" key={`${item.time}-${index}`}>
                <div className="monitor-chart-value">
                  {formatNumber(item.latency)} ms
                </div>

                <div className="monitor-chart-track">
                  <div
                    className="monitor-chart-bar"
                    style={{
                      height: `${Math.max(
                        5,
                        (item.latency / maxLatency) * 100
                      )}%`
                    }}
                  />
                </div>

                <span>{item.time}</span>
              </div>
            ))}
          </div>
        )}
      </article>

      <p className="monitor-last-updated">
        {lastUpdated
          ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
          : loading
            ? 'Loading monitoring data...'
            : 'No monitoring data available'}
        {' · '}Automatic refresh every 5 seconds
      </p>
    </section>
  )
}
