const API_BASE = ''

async function request(url) {
  const response = await fetch(`${API_BASE}${url}`)

  const text = await response.text()

  let data = null

  try {
    data = text ? JSON.parse(text) : null
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

export const getServiceHealth = (service) =>
  request(`/health/${service}`)

export const simulateRecommendationFailure = () =>
  request('/api/recommendations/failure')

export const simulateRecommendationDelay = (seconds = 3) =>
  request(`/api/recommendations/delay?seconds=${seconds}`)

// Week 3: Bulkhead
export const testBulkhead = (seconds = 5) =>
  request(`/api/recommendations/bulkhead?seconds=${seconds}`)

// Week 3: TimeLimiter
export const testTimeLimiter = (seconds = 4) =>
  request(`/api/recommendations/timelimit?seconds=${seconds}`)
