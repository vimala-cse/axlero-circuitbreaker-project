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
└── api-gateway/
```

## Coming in later weeks

- **Week 2** — Resilience4j Circuit Breaker on the
  recommendation-service route, a chaos endpoint to make that service
  slow/fail on demand, a basic React Chaos Dashboard.
- **Week 3** — Rate limiting + bulkheads on the gateway, ECharts-style
  State Visualization (circuit breaker state: Closed/Open/Half-Open)
  on the dashboard.
- **Week 4** — Distributed tracing (Micrometer + Zipkin) across the
  gateway and services, final UI polish with a "Trigger Latency"
  button to demo the breaker tripping live.
