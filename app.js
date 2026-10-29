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
  const query = document.querySelector('#service-search').value.trim().toLowerCase();
  const statusFilter = document.querySelector('#service-filter').value;
  const filteredServices = services.filter((service) => {
    const matchesQuery = `${service.name} ${service.detail}`.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'open' ? service.breaker === 'OPEN' : service.status === statusFilter);
    return matchesQuery && matchesStatus;
  });
  serviceRows.innerHTML = filteredServices.map((service) => {
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
  document.querySelector('#empty-state').hidden = filteredServices.length > 0;
  document.querySelector('#service-count').textContent = `${services.length} services`;
  document.querySelector('#nav-service-count').textContent = services.length;
  document.querySelector('#showing-count').textContent = filteredServices.length;
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

document.querySelector('#service-search').addEventListener('input', renderServices);
document.querySelector('#service-filter').addEventListener('change', renderServices);

document.querySelector('#refresh-services').addEventListener('click', (event) => {
  const button = event.currentTarget;
  button.classList.remove('spinning');
  requestAnimationFrame(() => button.classList.add('spinning'));
  document.querySelector('#last-refreshed').textContent = 'just now';
  window.setTimeout(() => button.classList.remove('spinning'), 650);
});

document.querySelector('#traffic-range').addEventListener('change', (event) => {
  const range = event.target.value;
  const labels = range === '24h'
    ? ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00']
    : range === '6h'
      ? ['04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00']
      : ['09:00', '09:10', '09:20', '09:30', '09:40', '09:50', '10:00'];
  document.querySelector('.chart-axis').innerHTML = labels.map((label) => `<span>${label}</span>`).join('');
  document.querySelector('.chart-error').innerHTML = `<i></i> ${range === '24h' ? '0.08%' : range === '6h' ? '0.07%' : '0.06%'} error rate`;
});

document.querySelector('#reset-breaker').addEventListener('click', () => {
  const recommendation = services.find((service) => service.id === 'recommendation');
  recommendation.breaker = 'HALF-OPEN';
  recommendation.status = 'healthy';
  recommendation.latency = 96;
  recommendation.instances = '2 / 2';
  renderServices();
  document.querySelector('#open-breaker-value').innerHTML = '0<span class="metric-unit">/ 6</span>';
  document.querySelector('#breaker-count').textContent = '0';
  document.querySelector('.breaker-gauge').style.background = 'radial-gradient(circle at center,#10141d 58%,transparent 60%),conic-gradient(from -90deg,var(--green) 0 60deg,#29303c 60deg 360deg)';
  const status = document.querySelector('.breaker-status-copy .status-pill');
  status.className = 'status-pill status-half';
  status.innerHTML = '<i></i> HALF-OPEN';
  document.querySelector('.breaker-status-copy h3').textContent = 'Recommendation Engine';
  document.querySelector('.breaker-status-copy p').textContent = 'Manual reset sent. Waiting for the next health probe.';
  document.querySelector('#reset-breaker').textContent = '✓  Probe in progress';
  document.querySelector('#reset-breaker').disabled = true;
  document.querySelector('#reset-breaker').style.opacity = '.7';
  events.unshift({ icon: '↻', tone: 'success', title: 'Circuit breaker manually reset', target: 'Recommendation Engine', detail: 'State changed to half-open · waiting for a health probe', time: 'just now' });
  renderEvents();
});

document.querySelectorAll('[data-scroll]').forEach((button) => {
  button.addEventListener('click', () => document.getElementById(button.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' }));
});

document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach((item) => item.classList.remove('active'));
    link.classList.add('active');
  });
});

window.setInterval(() => {
  const requests = 24891 + Math.floor(Math.random() * 24);
  document.querySelector('#requests-value').textContent = number(requests);
  document.querySelector('#chart-total').textContent = number(requests);
  document.querySelector('#last-refreshed').textContent = 'just now';
}, 5000);
