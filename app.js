const services = [
  { id: 'gateway', name: 'API Gateway', detail: 'gateway-service', symbol: '⇄', tone: 'teal', status: 'healthy', instances: '3 / 3', latency: 18, requests: 24891, breaker: 'CLOSED' },
  { id: 'checkout', name: 'Checkout Service', detail: 'checkout-service', symbol: '▣', tone: 'blue', status: 'healthy', instances: '3 / 3', latency: 64, requests: 8314, breaker: 'CLOSED' },
  { id: 'inventory', name: 'Inventory Service', detail: 'inventory-service', symbol: '▤', tone: 'green', status: 'healthy', instances: '2 / 2', latency: 37, requests: 12042, breaker: 'CLOSED' },
  { id: 'search', name: 'Search Service', detail: 'search-service', symbol: '⌕', tone: 'violet', status: 'healthy', instances: '2 / 2', latency: 29, requests: 15873, breaker: 'CLOSED' },
  { id: 'recommendation', name: 'Recommendation Engine', detail: 'recommendation-service', symbol: '✳', tone: 'orange', status: 'degraded', instances: '1 / 2', latency: 842, requests: 3921, breaker: 'OPEN' },
  { id: 'payment', name: 'Payment Service', detail: 'payment-service', symbol: '↗', tone: 'pink', status: 'healthy', instances: '3 / 3', latency: 91, requests: 4820, breaker: 'CLOSED' },
];

const events = [
  { icon: 'ϟ', tone: 'warning', title: 'Circuit breaker opened', target: 'Recommendation Engine', detail: 'Failure rate exceeded 50% threshold · fallback response enabled', time: '2m ago' },
  { icon: '↻', tone: 'info', title: 'Retry scheduled', target: 'Recommendation Engine', detail: 'Next half-open probe in 30 seconds', time: '2m ago' },
  { icon: '✓', tone: 'success', title: 'Service instance registered', target: 'Inventory Service', detail: 'inventory-service-7df8b7 · us-east-1a', time: '8m ago' },
  { icon: '⌁', tone: 'info', title: 'Fallback response served', target: 'Top Sellers cache', detail: 'Recommendation route · 12 ms response time', time: '11m ago' },
];

const number = (value) => new Intl.NumberFormat('en-US').format(value);
const serviceRows = document.querySelector('#service-rows');
const eventList = document.querySelector('#event-list');

function renderServices() {
  serviceRows.innerHTML = services.map((service) => {
    const healthLabel = service.status === 'degraded' ? 'Degraded' : 'Healthy';
    const breakerClass = service.breaker === 'OPEN' ? 'open' : service.breaker === 'HALF-OPEN' ? 'half' : '';
    const latencyClass = service.latency > 150 ? 'slow' : '';
    return `<tr data-service="${service.id}">
      <td><div class="service-name-cell"><span class="service-symbol ${service.tone}">${service.symbol}</span><span><span class="service-name">${service.name}</span><span class="service-subname">${service.detail}</span></span></div></td>
      <td><span class="service-health ${service.status}"><i></i>${healthLabel}</span></td>
      <td><span class="instance-count">${service.instances}</span></td>
      <td><span class="latency-value ${latencyClass}">${service.latency} ms</span></td>
      <td><span class="request-count">${number(service.requests)}</span></td>
      <td><span class="breaker-mini ${breakerClass}">${service.breaker}</span></td>
      <td><button class="row-menu" type="button" aria-label="Actions for ${service.name}">···</button></td>
    </tr>`;
  }).join('');
  document.querySelector('#service-count').textContent = `${services.length} services`;
  document.querySelector('#nav-service-count').textContent = services.length;
  document.querySelector('#showing-count').textContent = services.length;
}

function chartPath(values, width, height, max) {
  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - (value / max) * height;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function renderTrafficChart() {
  const requests = [46, 52, 44, 62, 53, 66, 71, 61, 76, 68, 82, 73, 84, 76, 91, 80, 89, 77, 94, 85, 97, 87, 100, 88, 96, 82, 94, 79, 89, 72, 85, 75, 92, 79, 96, 84, 98, 89, 100, 91];
  const errors = [3, 4, 3, 6, 4, 5, 4, 7, 4, 3, 5, 7, 4, 6, 4, 5, 3, 6, 5, 4, 6, 4, 3, 5, 7, 4, 6, 3, 5, 4, 7, 5, 4, 6, 4, 5, 3, 5, 4, 6];
  const width = 680;
  const height = 104;
  const req = chartPath(requests, width, height, 105);
  const err = chartPath(errors, width, height, 105);
  const grid = [0, 1, 2, 3].map((row) => `<line class="chart-grid-line" x1="0" y1="${row * (height / 3)}" x2="${width}" y2="${row * (height / 3)}" />`).join('');
  document.querySelector('#traffic-chart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="traffic-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4bd5bf" /><stop offset="1" stop-color="#4bd5bf" stop-opacity="0" /></linearGradient></defs>${grid}<path class="chart-area" fill="url(#traffic-fill)" d="${req} L${width},${height} L0,${height} Z"/><path class="chart-line requests" d="${req}"/><path class="chart-line errors" d="${err}"/></svg>`;
}

function renderEvents() {
  eventList.innerHTML = events.map((event) => `<div class="event-row"><span class="event-icon ${event.tone}">${event.icon}</span><div class="event-copy"><strong>${event.title}</strong> · ${event.target}<span>${event.detail}</span></div><time class="event-time">${event.time}</time></div>`).join('');
}

renderServices();
renderTrafficChart();
renderEvents();
