# CircuitBreaker — Gateway Console

A responsive frontend dashboard for the Axlero cloud-native e-commerce API gateway project. It presents gateway traffic, microservice health, service discovery, and Resilience4j circuit-breaker activity in one operations view.

## Run locally

Node.js 18 or newer is required. From the project folder, run:

```bash
npm run dev
```

Then open the local URL printed in the terminal (by default, `http://127.0.0.1:5173`). The dashboard uses native HTML, CSS, and JavaScript; no package installation is needed.

## Dashboard features

- Gateway request volume, average latency, success rate, and open-breaker metrics.
- Request and error chart with 1-hour, 6-hour, and 24-hour time-range controls.
- Service table with instance counts, latency, request volume, and breaker state.
- Search and status filters for the registered microservices.
- Circuit-breaker reset control that moves the recommendation service to a half-open probe state.
- Recent event feed for breaker changes, service registration, retries, and cached fallback responses.
- Responsive layout for desktop and mobile screens.

## Project requirements represented

The interface is designed around the project brief: Spring Cloud Gateway is the frontend traffic entry point, Resilience4j protects services from cascading failures, service discovery tracks microservice instances, and an operations UI surfaces health and fallback activity. The sample services include Gateway, Checkout, Inventory, Search, Recommendation, and Payment.

## Frontend demo data

The current repository contains the dashboard frontend only; it does not include the Spring services or a connected API. Service health, traffic, and event entries are representative demo data. Request totals refresh locally to demonstrate the live status treatment. The reset control updates the demo breaker to half-open and records an event in the browser; it does not call a backend.

When the gateway API is available, replace the sample data in `app.js` with responses from its health, metrics, service registry, and breaker endpoints.

## Files

- `package.json` — the `npm run dev` shortcut.
- `server.mjs` — dependency-free local static server.
- `index.html` — dashboard structure and navigation.
- `styles.css` — responsive dark operations-console styling.
- `app.js` — demo services, chart rendering, event feed, and client-side controls.
