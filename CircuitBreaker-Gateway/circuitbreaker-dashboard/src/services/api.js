
const API_BASE = ''

async function request(url) {
  const response = await fetch(`${API_BASE}${url}`)
  const text = await response.text()

  let data = null

  try {
    data = text ? JSON.parse(text) : text
  } catch {
    data = text
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || `Request failed: ${response.status}`
    )

    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

export const getProducts = () =>
  request('/api/products')

export const getInventory = (productId) =>
  request(`/api/inventory/${productId}`)

export const getRecommendations = () =>
  request('/api/recommendations')

export const simulateRecommendationFailure = () =>
  request('/api/recommendations/failure')

export const simulateRecommendationDelay = (seconds = 3) =>
  request(`/api/recommendations/delay?seconds=${seconds}`)

export const testBulkhead = (seconds = 5) =>
  request(`/api/recommendations/bulkhead?seconds=${seconds}`)

export const testTimeLimiter = (seconds = 4) =>
  request(`/api/recommendations/timelimit?seconds=${seconds}`)

export const testLatency = (seconds = 3) =>
  request(`/api/recommendations/delay?seconds=${seconds}`)

export const getServiceHealth = (service) =>
  request(`/health/${service}`)

export const getAllServiceHealth = async () => {
  const services = [
    'gateway',
    'product',
    'inventory',
    'recommendation'
  ]

  const results = await Promise.allSettled(
    services.map(async (service) => ({
      service,
      health: await getServiceHealth(service)
    }))
  )

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return {
        service: result.value.service,
        status: result.value.health.status || 'UNKNOWN',
        details: result.value.health
      }
    }

    return {
      service: services[index],
      status: 'DOWN',
      error: result.reason?.message || 'Service unavailable'
    }
  })
}

export const ZIPKIN_URL = 'http://localhost:9411/zipkin/'
