# CircuitBreaker — Cloud-Native E-Commerce API Gateway

A Spring Cloud microservices system that demonstrates resilience patterns
(circuit breaking, rate limiting, bulkheads) protecting an e-commerce site
from a failing downstream service. Built for the Axlero Solutions
internship, Project 3.

## Problem Statement

In a microservices architecture, if one service (e.g. the Recommendation
Engine) slows down or fails, every service that calls it can hang and
drag the whole system down with it. This project builds an API Gateway
that detects a struggling service and "opens the circuit" — instantly
failing fast with a fallback response instead of letting requests pile
up — so the rest of the site keeps working.

## Week 1 — What's built so far

- **eureka-server** (port 8761) — the service registry. Every other
  service registers itself here on startup.
- **product-service** (port 8081) — product catalog.
- **inventory-service** (port 8082) — stock levels per product.
- **recommendation-service** (port 8083) — "you might also like"
  recommendations. This is the service we'll deliberately make
  unreliable from Week 2 onward, to prove the Circuit Breaker works.
- **api-gateway** (port 8080) — single entry point. Routes
  `/api/products/**`, `/api/inventory/**`, `/api/recommendations/**` to
  the right backend service by looking it up in Eureka (`lb://...`),
  so it never hard-codes a host or port.

## How to run it (in order)

Each module is run with `mvn spring-boot:run` from its own folder, or
by running its `*Application.java` main class in IntelliJ. Eureka must
be up first.

```bash
cd eureka-server          && mvn spring-boot:run     # 1. start this first
cd product-service        && mvn spring-boot:run     # 2.
cd inventory-service      && mvn spring-boot:run     # 3.
cd recommendation-service && mvn spring-boot:run     # 4.
cd api-gateway            && mvn spring-boot:run     # 5. start this last
```

Then check:
- Eureka dashboard: http://localhost:8761 — you should see all 4
  services registered (product-service, inventory-service,
  recommendation-service, api-gateway).
- Through the gateway: http://localhost:8080/api/products — should
  return the product list, even though the gateway itself has no idea
  what a product is; it just forwarded the request to product-service.
- Same for http://localhost:8080/api/inventory and
  http://localhost:8080/api/recommendations/P-101.
- Gateway's own view of its routes:
  http://localhost:8080/actuator/gateway/routes

If `/api/products` works through port **8080** (the gateway) but you
never call port 8081 directly, that's the Routing Audit proof the
project guide asks for — dynamic routing via service discovery,
not a hard-coded address.

## Tech Stack

- Java 17, Spring Boot 3.2.5, Spring Cloud 2023.0.1 (Leyton)
- Spring Cloud Gateway (reactive), Netflix Eureka (service discovery)
- Maven multi-module project

## Project Structure

```
circuitbreaker-gateway/
├── pom.xml                     (parent — lists all 5 modules)
├── eureka-server/
├── product-service/
├── inventory-service/
├── recommendation-service/
├── api-gateway/
└── dashboard/                  (React + Vite monitoring / chaos dashboard)
```

## Week 2 — Circuit breaker, chaos switch and dashboard

**What was added**

- **Circuit breaker on the gateway** (Resilience4j). The
  `/api/recommendations/**` route is wrapped in a breaker called
  `recommendationCB`. If the Recommendation service is slow (over 3 s),
  fails (HTTP 500/502/503/504) or is stopped, the gateway stops waiting
  and answers instantly with a safe fallback list of **Top Sellers**
  (`FallbackController`). Rules live in `ResilienceConfig.java`:
  judge the last 10 calls, open at 50% failures or slow calls (after at
  least 5 calls), stay open 10 s, then let 3 test calls through
  (half-open) before closing again.
- **Chaos switch** in recommendation-service. `ChaosState` can put the
  service into `normal`, `slow` (waits 4 s) or `fail` (HTTP 500) at any
  time, without a restart. This reproduces the Black Friday use case from
  the project guide.
- **Gateway routes for the dashboard**: `/chaos` (the chaos switch, left
  outside the breaker on purpose) and `/services/<name>/health` (each
  service's health, read through the gateway).
- **React dashboard** (`dashboard/`): service health cards, chaos
  control buttons, a live request log (live / fallback / error counts),
  a "send 12 at once" burst button and a storefront preview that keeps
  working when the Recommendation service is down.

**New endpoints (all through the gateway on port 8080)**

| Endpoint | Purpose |
|---|---|
| `GET /chaos` | current chaos mode of recommendation-service |
| `POST /chaos?mode=normal\|slow\|fail&delayMs=4000` | change the chaos mode |
| `GET /services/product/health` | product-service health (also `inventory`, `recommendation`) |
| `GET /fallback/recommendations` | the fallback answer (used internally by the breaker) |

**Run the dashboard**

```bash
cd dashboard
npm install
npm run dev        # opens on http://localhost:5173
```

Start the 5 backend services first (same order as Week 1). The
dashboard reads from `http://localhost:8080`; to point it somewhere else,
set `VITE_API_BASE`.

**Demo script (Mid-Project Review)**

1. All four health cards are green, recommendation badges say **LIVE**.
2. Click **Fail (HTTP 500)**. Badges flip to **FALLBACK**. The product
   list and stock keep working.
3. Click **Send 12 at once**. After about 5 failures the breaker opens
   and fallbacks come back in a few milliseconds.
4. Click **Normal**. After about 10 seconds the breaker lets test calls
   through and the badges return to **LIVE**.
5. Stop recommendation-service in IntelliJ. The health card turns red,
   but the storefront still loads (fallback data, no hanging).

## Coming in later weeks

- **Week 3** — Rate limiting and bulkheads on the gateway; the dashboard
  shows the breaker state explicitly (Green = Closed, Red = Open,
  Yellow = Half-Open).
- **Week 4** — Distributed tracing (Micrometer + Zipkin) across the
  gateway and services, plus a "Trigger Latency" button in the dashboard
  to show the breaker tripping live.
