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
const toastViewport = document.querySelector('#toast-viewport');
let toastTimer;
let serviceSort = { field: null, direction: 1 };
let lastRefreshedAt = Date.now();
let selectedServiceId = '';

function updateRefreshAge() {
  const elapsedSeconds = Math.floor((Date.now() - lastRefreshedAt) / 1000);
  const label = elapsedSeconds < 60 ? 'just now' : `${Math.floor(elapsedSeconds / 60)}m ago`;
  document.querySelector('#last-refreshed').textContent = label;
  document.querySelector('#registry-last-refreshed').textContent = label;
}

function markRefreshed() {
  lastRefreshedAt = Date.now();
  updateRefreshAge();
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-card';
  toast.innerHTML = '<span class="toast-check" aria-hidden="true">✓</span><span class="toast-message"></span>';
  toast.querySelector('.toast-message').textContent = message;
  toastViewport.replaceChildren(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('visible');
    window.setTimeout(() => toast.remove(), 220);
  }, 2800);
}

function getVisibleServices() {
  const query = document.querySelector('#service-search').value.trim().toLowerCase();
  const statusFilter = document.querySelector('#service-filter').value;
  const filteredServices = services.filter((service) => {
    const matchesQuery = `${service.name} ${service.detail}`.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'open' && service.breaker === 'OPEN')
      || (statusFilter === 'half-open' && service.breaker === 'HALF-OPEN')
      || (['healthy', 'degraded'].includes(statusFilter) && service.status === statusFilter);
    return matchesQuery && matchesStatus;
  });
  return [...filteredServices].sort((left, right) => {
    if (!serviceSort.field) return 0;
    const leftValue = serviceSort.field === 'name' ? left.name : left[serviceSort.field];
    const rightValue = serviceSort.field === 'name' ? right.name : right[serviceSort.field];
    return (typeof leftValue === 'string' ? leftValue.localeCompare(rightValue) : leftValue - rightValue) * serviceSort.direction;
  });
}

function renderServices() {
  const filteredServices = getVisibleServices();
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
      <td><button class="row-menu" type="button" data-service-details="${service.id}" aria-label="View details for ${service.name}">···</button></td>
    </tr>`;
  }).join('');
  document.querySelector('#empty-state').hidden = filteredServices.length > 0;
  document.querySelector('#service-count').textContent = `${services.length} services`;
  document.querySelector('#service-total').textContent = services.length;
  document.querySelector('#nav-service-count').textContent = services.length;
  document.querySelector('#showing-count').textContent = filteredServices.length;
  document.querySelector('#export-services').disabled = filteredServices.length === 0;
}

function chartPath(values, width, height, max) {
  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - (value / max) * height;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

const trafficSeries = {
  '1h': {
    requests: [46, 52, 44, 62, 53, 66, 71, 61, 76, 68, 82, 73, 84, 76, 91, 80, 89, 77, 94, 85, 97, 87, 100, 88, 96, 82, 94, 79, 89, 72, 85, 75, 92, 79, 96, 84, 98, 89, 100, 91],
    errors: [3, 4, 3, 6, 4, 5, 4, 7, 4, 3, 5, 7, 4, 6, 4, 5, 3, 6, 5, 4, 6, 4, 3, 5, 7, 4, 6, 3, 5, 4, 7, 5, 4, 6, 4, 5, 3, 5, 4, 6],
    total: 24891,
    errorRate: '0.06%',
  },
  '6h': {
    requests: [54, 61, 58, 68, 63, 74, 71, 82, 77, 88, 84, 96, 90, 101],
    errors: [4, 5, 3, 6, 5, 4, 7, 5, 4, 6, 5, 3, 6, 4],
    total: 148206,
    errorRate: '0.07%',
  },
  '24h': {
    requests: [38, 44, 49, 46, 55, 59, 53, 63, 68, 64, 73, 78, 71, 82, 87, 81, 92, 97, 89, 100],
    errors: [5, 4, 6, 4, 5, 7, 4, 5, 3, 6, 4, 5, 7, 4, 6, 3, 5, 4, 6, 4],
    total: 581274,
    errorRate: '0.08%',
  },
};

let selectedTrafficRange = '1h';

function renderTrafficChart(range = '1h') {
  const { requests, errors, total, errorRate } = trafficSeries[range];
  const width = 680;
  const height = 104;
  const req = chartPath(requests, width, height, 105);
  const err = chartPath(errors, width, height, 105);
  const grid = [0, 1, 2, 3].map((row) => `<line class="chart-grid-line" x1="0" y1="${row * (height / 3)}" x2="${width}" y2="${row * (height / 3)}" />`).join('');
  const rangeLabel = range === '1h' ? 'the last hour' : `the last ${range === '6h' ? '6' : '24'} hours`;
  const chart = document.querySelector('#traffic-chart');
  chart.setAttribute('aria-label', `Requests and errors over ${rangeLabel}`);
  chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="traffic-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4bd5bf" /><stop offset="1" stop-color="#4bd5bf" stop-opacity="0" /></linearGradient></defs>${grid}<path class="chart-area" fill="url(#traffic-fill)" d="${req} L${width},${height} L0,${height} Z"/><path class="chart-line requests" pathLength="100" d="${req}"/><path class="chart-line errors" pathLength="100" d="${err}"/></svg>`;
  document.querySelector('#chart-total').textContent = number(total);
  document.querySelector('.chart-error').innerHTML = `<i></i> ${errorRate} error rate`;
}

function renderEvents() {
  const category = document.querySelector('#event-filter').value;
  const visibleEvents = category === 'all' ? events : events.filter((event) => event.tone === category);
  eventList.innerHTML = visibleEvents.map((event) => `<div class="event-row"><span class="event-icon ${event.tone}">${event.icon}</span><div class="event-copy"><strong>${event.title}</strong> · ${event.target}<span>${event.detail}</span></div><time class="event-time">${event.time}</time></div>`).join('');
  document.querySelector('#events-empty').hidden = visibleEvents.length > 0;
}

function updateBreakerSummary() {
  const openBreakers = services.filter((service) => service.breaker === 'OPEN');
  const probingBreakers = services.filter((service) => service.breaker === 'HALF-OPEN');
  document.querySelector('#open-breaker-value').innerHTML = `${openBreakers.length}<span class="metric-unit">/ ${services.length}</span>`;
  document.querySelector('#breaker-count').textContent = openBreakers.length;
  const metricStatus = document.querySelector('#breaker-metric-status');
  const metricCaption = document.querySelector('#breaker-metric-caption');
  const metricCard = document.querySelector('#breaker-metric-card');
  const metricIcon = document.querySelector('#breaker-metric-icon');
  const needsAttention = openBreakers.length > 0 || probingBreakers.length > 0;
  metricCard.classList.toggle('metric-alert', openBreakers.length > 0);
  metricCard.classList.toggle('metric-clear', !needsAttention);
  metricIcon.className = `metric-icon ${openBreakers.length ? 'orange-icon' : probingBreakers.length ? 'violet-icon' : 'green-icon'}`;
  metricStatus.className = openBreakers.length ? 'trend-warning' : probingBreakers.length ? 'trend-probing' : 'trend-positive';
  metricStatus.textContent = openBreakers.length ? '● Needs attention' : probingBreakers.length ? '◌ Probe running' : '✓ All clear';
  metricCaption.textContent = openBreakers.length ? openBreakers.map((service) => service.name).join(', ') : probingBreakers.length ? probingBreakers.map((service) => service.name).join(', ') : 'No open breakers';
  const breakerNavDot = document.querySelector('.nav-dot');
  breakerNavDot.hidden = !needsAttention;
  if (openBreakers.length) breakerNavDot.setAttribute('aria-label', `${openBreakers.length} open`);
  else if (probingBreakers.length) breakerNavDot.setAttribute('aria-label', 'Breaker probe in progress');
  else breakerNavDot.removeAttribute('aria-label');
  document.querySelector('.breaker-gauge').setAttribute('aria-label', `${openBreakers.length} circuit breakers open out of ${services.length}`);
}

function renderNotifications() {
  document.querySelector('#notification-list').innerHTML = events.map((event) => `<div class="notification-item"><span class="event-icon ${event.tone}">${event.icon}</span><div class="event-copy"><strong>${event.title}</strong> · ${event.target}<span>${event.detail}</span></div><time class="event-time">${event.time}</time></div>`).join('');
}

renderServices();
renderTrafficChart();
renderEvents();

document.querySelector('#event-filter').addEventListener('change', renderEvents);
document.querySelector('#reset-event-filter').addEventListener('click', () => {
  document.querySelector('#event-filter').value = 'all';
  renderEvents();
});

document.querySelector('#service-search').addEventListener('input', renderServices);
document.querySelector('#service-filter').addEventListener('change', renderServices);
document.querySelector('#clear-service-filters').addEventListener('click', () => {
  document.querySelector('#service-search').value = '';
  document.querySelector('#service-filter').value = 'all';
  renderServices();
  document.querySelector('#service-search').focus();
});

document.querySelectorAll('[data-sort]').forEach((button) => {
  button.addEventListener('click', () => {
    const field = button.dataset.sort;
    serviceSort = { field, direction: serviceSort.field === field ? -serviceSort.direction : 1 };
    document.querySelectorAll('[data-sort]').forEach((item) => {
      const active = item === button;
      item.closest('th').setAttribute('aria-sort', active ? (serviceSort.direction === 1 ? 'ascending' : 'descending') : 'none');
      item.querySelector('span').textContent = active ? (serviceSort.direction === 1 ? '↑' : '↓') : '↕';
    });
    renderServices();
  });
});

const serviceDetailsDialog = document.querySelector('#service-details-dialog');
serviceRows.addEventListener('click', (event) => {
  const button = event.target.closest('[data-service-details]');
  if (!button) return;
  const service = services.find((item) => item.id === button.dataset.serviceDetails);
  if (!service) return;
  selectedServiceId = service.detail;
  document.querySelector('#service-details-title').textContent = service.name;
  document.querySelector('#service-details-id').textContent = service.detail;
  document.querySelector('#service-details-status').textContent = `${service.status[0].toUpperCase()}${service.status.slice(1)} · ${service.breaker}`;
  document.querySelector('#service-details-instances').textContent = service.instances;
  document.querySelector('#service-details-latency').textContent = `${service.latency} ms`;
  document.querySelector('#service-details-requests').textContent = number(service.requests);
  serviceDetailsDialog.showModal();
});
serviceDetailsDialog.querySelector('[data-close-dialog]').addEventListener('click', () => serviceDetailsDialog.close());
document.querySelector('#copy-service-id').addEventListener('click', async () => {
  try {
    if (!navigator.clipboard) throw new Error('Clipboard is unavailable');
    await navigator.clipboard.writeText(selectedServiceId);
    showToast('Service ID copied');
  } catch {
    const idText = document.querySelector('#service-details-id');
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(idText);
    selection.removeAllRanges();
    selection.addRange(range);
    showToast('Service ID selected · press Ctrl+C to copy');
  }
});

const notificationsDialog = document.querySelector('#notifications-dialog');
document.querySelector('#notifications-button').addEventListener('click', () => {
  renderNotifications();
  notificationsDialog.showModal();
});
notificationsDialog.querySelector('[data-close-dialog]').addEventListener('click', () => notificationsDialog.close());
document.querySelector('#mark-notifications-read').addEventListener('click', () => {
  document.querySelector('.notification-dot').hidden = true;
  notificationsDialog.close();
});
const helpDialog = document.querySelector('#help-dialog');
document.querySelector('#help-button').addEventListener('click', () => helpDialog.showModal());
helpDialog.querySelector('[data-close-dialog]').addEventListener('click', () => helpDialog.close());

document.querySelector('#refresh-services').addEventListener('click', (event) => {
  const button = event.currentTarget;
  button.classList.remove('spinning');
  requestAnimationFrame(() => button.classList.add('spinning'));
  markRefreshed();
  window.setTimeout(() => button.classList.remove('spinning'), 650);
  showToast('Demo service registry is up to date');
});

document.querySelector('#export-services').addEventListener('click', () => {
  const visibleServices = getVisibleServices();
  if (!visibleServices.length) return;
  const fields = [
    ['Service', (service) => service.name],
    ['Service ID', (service) => service.detail],
    ['Health', (service) => service.status],
    ['Instances', (service) => service.instances],
    ['Average latency (ms)', (service) => service.latency],
    ['Requests per minute', (service) => service.requests],
    ['Circuit breaker', (service) => service.breaker],
  ];
  const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [fields.map(([label]) => csvCell(label)).join(','), ...visibleServices.map((service) => fields.map(([, value]) => csvCell(value(service))).join(','))].join('\r\n');
  const file = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `circuitbreaker-services-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`Exported ${visibleServices.length} service${visibleServices.length === 1 ? '' : 's'} to CSV`);
});

document.querySelector('#traffic-range').addEventListener('change', (event) => {
  const range = event.target.value;
  selectedTrafficRange = range;
  renderTrafficChart(range);
  const labels = range === '24h'
    ? ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00']
    : range === '6h'
      ? ['04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00']
      : ['09:00', '09:10', '09:20', '09:30', '09:40', '09:50', '10:00'];
  document.querySelector('.chart-axis').innerHTML = labels.map((label) => `<span>${label}</span>`).join('');
});

document.querySelector('#reset-breaker').addEventListener('click', () => {
  const recommendation = services.find((service) => service.id === 'recommendation');
  recommendation.breaker = 'HALF-OPEN';
  recommendation.status = 'healthy';
  recommendation.latency = 96;
  recommendation.instances = '2 / 2';
  renderServices();
  updateBreakerSummary();
  const gauge = document.querySelector('.breaker-gauge');
  gauge.dataset.state = 'half-open';
  gauge.style.background = '';
  const status = document.querySelector('.breaker-status-copy .status-pill');
  status.className = 'status-pill status-half';
  status.innerHTML = '<i></i> HALF-OPEN';
  document.querySelector('.breaker-status-copy h3').textContent = 'Recommendation Engine';
  document.querySelector('.breaker-status-copy p').textContent = 'Manual reset sent. Waiting for the next health probe.';
  document.querySelector('#reset-breaker').textContent = '✓  Probe in progress';
  document.querySelector('#reset-breaker').disabled = true;
  events.unshift({ icon: '↻', tone: 'success', title: 'Circuit breaker manually reset', target: 'Recommendation Engine', detail: 'State changed to half-open · waiting for a health probe', time: 'just now' });
  document.querySelector('.notification-dot').hidden = false;
  renderEvents();
  document.querySelector('#nav-event-count').textContent = events.length;
  showToast('Recommendation Engine is half-open');
  window.setTimeout(() => {
    recommendation.breaker = 'CLOSED';
    recommendation.status = 'healthy';
    recommendation.latency = 74;
    renderServices();
    updateBreakerSummary();
    gauge.dataset.state = 'closed';
    status.className = 'status-pill status-closed';
    status.innerHTML = '<i></i> CLOSED';
    document.querySelector('.breaker-status-copy p').textContent = 'Health probe passed. Normal traffic has resumed.';
    document.querySelector('#failed-calls').textContent = '0';
    document.querySelector('#reset-breaker').textContent = '✓  Breaker recovered';
    events.unshift({ icon: '✓', tone: 'success', title: 'Circuit breaker closed', target: 'Recommendation Engine', detail: 'Health probe passed · normal traffic resumed', time: 'just now' });
    renderEvents();
    document.querySelector('#nav-event-count').textContent = events.length;
    document.querySelector('.notification-dot').hidden = false;
    showToast('Recommendation Engine recovered');
  }, 2200);
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

document.addEventListener('keydown', (event) => {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return;
  if (event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
  event.preventDefault();
  document.querySelector('#service-search').focus();
});

window.setInterval(() => {
  const requests = 24891 + Math.floor(Math.random() * 24);
  document.querySelector('#requests-value').textContent = number(requests);
  if (selectedTrafficRange === '1h') document.querySelector('#chart-total').textContent = number(requests);
  updateRefreshAge();
}, 5000);
