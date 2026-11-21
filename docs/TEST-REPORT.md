# CircuitBreaker: Test Report

Project 3, Axlero Solutions internship. Testers: Vimala, Samata Chougule.

This file lists every test we run on the system, what we expect, and what we actually saw. Rows marked **Observed** were already checked on the date shown. The rest are **Pending** and are filled in as we test.

## How to run the system for testing

1. Start Eureka, product-service, inventory-service, recommendation-service and api-gateway in IntelliJ.
2. Start Zipkin: `java -jar zipkin.jar` (needs Java 17), page at http://localhost:9411
3. Start the dashboard: `npm run dev` in `circuitbreaker-gateway/dashboard`, page at http://localhost:5173

## Settings being tested

| Setting | Value |
|---|---|
| Circuit breaker window | last 10 calls, needs at least 5 |
| Opens when | 50% of calls fail, or 50% are slower than 2 s |
| Timeout (TimeLimiter) | 3 s per call |
| Stays open | 10 s, then half-open automatically (3 trial calls) |
| Rate limiter | 20 requests per second per client, extra requests get 429 |
| Bulkhead | 5 concurrent calls on `/api/recommendations`, extra get 503 |
| Fallback answer | `{ "fallback": true, "recommendations": [P-105, P-102, P-101] }` |

## Test cases

Status values: **Pass**, **Fail**, **Pending**.

### A. Routing and discovery (mid-project review)

| ID | Test | Steps | Expected | Actual | Status |
|---|---|---|---|---|---|
| T1 | Services register in Eureka | Open http://localhost:8761 | API-GATEWAY, PRODUCT-SERVICE, INVENTORY-SERVICE, RECOMMENDATION-SERVICE all show UP | All four services listed as UP with their ports 8080, 8082, 8081, 8083 (observed 19-11-2026, screenshots/t1-eureka-registered.png) | Pass |
| T2 | Gateway routes to every service | Open `/api/products`, `/api/inventory`, `/api/recommendations/P-101` on port 8080 | Each returns 200 with its own data | Dashboard shows products, stock and recommendations (observed 16-11-2026) | Pass |

### B. Circuit breaker and chaos (mid-project and final review)

| ID | Test | Steps | Expected | Actual | Status |
|---|---|---|---|---|---|
| T3 | Slow service opens the breaker | Click **Trigger latency**, wait about 10 s | Breaker shows Open, answers become Backup, page stays responsive | Breaker went Open, Recommendation lever dropped, backup answers shown (observed 16-11-2026) | Pass |
| T4 | Failing service opens the breaker | Choose **Fail (500)**, send **12 at once** | Breaker opens, shoppers get Backup answers | | Pending |
| T5 | Service stopped completely | Stop recommendation-service in IntelliJ, wait 30 s | Fallback answers, Recommendation lever shows Down, product and inventory still work, nothing hangs | Recommendation lever went red (Down, No answer), breaker Open, backup answers came back in 4 to 9 ms, shopper page still showed products, stock and Top Sellers. While the service stayed down the breaker kept cycling Open, Half-open, Open about every 10 s, because its trial calls failed (observed 19-11-2026, screenshots/t5-service-down.png and t5-events-log.png) | Pass |
| T5b | Recovery after the service is started again | Start recommendation-service again, wait about 20 s | Breaker goes back to Closed, headline says all services healthy, answers are Live | Dashboard returned to "All services healthy", breaker Closed (observed 19-11-2026, screenshots/t5-recovered.png) | Pass |
| T6 | Recovery | Click **Back to normal**, wait 10 to 15 s | Breaker goes Half-open then Closed, answers are Live again | | Pending |
| T7 | Rest of the shop stays fast while breaker is open | With breaker Open, open `/api/products` | Still answers in milliseconds | Products and stock were still shown while the breaker was Open and Half-open, product and inventory health checks stayed green (observed 19-11-2026) | Pass |

### C. Rate limiter and bulkhead (Week 3)

| ID | Test | Steps | Expected | Actual | Status |
|---|---|---|---|---|---|
| T8 | Rate limiter blocks floods | Click **Test with 30 fast requests** | About 20 allowed, the rest blocked with 429 | 20 allowed, 10 blocked (observed 16-11-2026) | Pass |
| T9 | Bulkhead rejects extra concurrent calls | Breaker Closed, Recommendation in Slow mode, then 15 requests at once from Git Bash (parallel curl) | At most 5 admitted at once, the rest rejected at once with 503 | 4 requests were admitted and answered after 3.0 s, 11 were rejected with 503 in under 0.1 s. `/gateway/protection` showed bulkhead rejected = 11, in use = 0 afterwards (observed 20-11-2026, output in the Evidence section) | Pass |
| T10 | Dashboard shows real counters | Compare tiles with http://localhost:8080/gateway/protection | Numbers match | Rate limiter tile showed limit 20 and blocked count (observed 16-11-2026) | Pass |

### D. Tracing (Week 4)

| ID | Test | Steps | Expected | Actual | Status |
|---|---|---|---|---|---|
| T11 | One trace across services | Send a request, open Zipkin, click **Run Query** | A trace with 3 spans: gateway then the backend service | 3-span traces for api-gateway requests (observed 16-11-2026) | Pass |
| T12 | Trace id in logs | Look at IntelliJ console after a request | Log lines contain `[service-name, traceId, spanId]` | | Pending |

### E. Dashboard

| ID | Test | Steps | Expected | Actual | Status |
|---|---|---|---|---|---|
| T13 | Light and dark theme | Click the theme button | Theme changes, text stays readable | Both themes checked (observed 16-11-2026) | Pass |
| T14 | Mobile layout | Open on a narrow window or zoom to 300% | Tiles stack, nothing is cut off | | Pending |
| T15 | Events log | Trigger latency, then Back to normal | "What happened" lists the mode change, Open, Half-open and Closed with times | | Pending |

## Defects found

| ID | Problem | Found on | Fix | Status |
|---|---|---|---|---|
| D1 | Storefront showed no recommendations and no stock (service answers were a list and a map, dashboard expected objects) | 09-11-2026 | Dashboard now reads both formats | Fixed |
| D2 | Bulkhead tile said "limit not active" when answers were just too fast to overlap | 16-11-2026 | Test now switches Recommendation to Slow, message explains the reason | Fixed |
| D3 | Dashboard bulkhead test showed 0 rejected: the first command-line run also gave 15 x 200 because the breaker was not Closed, so every answer was an instant backup and requests never overlapped | 20-11-2026 | Bulkhead itself is fine. Dashboard test now pauses background polling and tells the tester when the breaker is not Closed | Fixed |

## Evidence: bulkhead test from the command line (20-11-2026)

Breaker state before the test: `CLOSED`, 10 calls in the window, 0 failed.

```
200 3.005207s
200 3.012974s
200 3.015850s
200 3.016011s
503 0.001912s
503 0.002310s
503 0.002468s
503 0.002641s
503 0.002754s
503 0.002948s
503 0.004074s
503 0.019194s
503 0.036506s
503 0.043242s
503 0.053278s
```

`GET /gateway/protection` afterwards:

```
{"rateLimiter":{"enabled":true,"limitPerSecond":20,"allowed":501,"rejected":0},
 "bulkhead":{"enabled":true,"maxConcurrent":5,"inUse":0,"rejected":11}}
```

Four admitted calls instead of five: the dashboard's own background request was holding one slot.

## Summary

Filled in at the end: total tests, passed, failed, date, tester names.
