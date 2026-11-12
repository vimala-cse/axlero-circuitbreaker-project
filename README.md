# CircuitBreaker – Cloud-Native E-Commerce API Gateway

A cloud-native microservices-based e-commerce application demonstrating API Gateway routing, service discovery, fault tolerance, distributed tracing, and real-time service monitoring.

## Project Overview

CircuitBreaker is designed to improve the reliability and availability of e-commerce applications using Spring Boot microservices and Spring Cloud.

The application uses an API Gateway to route client requests to independent services. It integrates Resilience4j to handle service failures, control request traffic, manage concurrent requests, and prevent long-running operations from affecting application responsiveness.

A React dashboard provides a visual interface for monitoring services and demonstrating resilience mechanisms.

## Architecture

```text
                 React Dashboard
                    (Port 5173)
                         |
                         v
                  API Gateway
                    (8080)
                         |
             +-----------+-----------+
             |           |           |
             v           v           v
       Product       Inventory   Recommendation
       Service        Service       Service
        (8081)         (8082)        (8083)
             |           |           |
             +-----------+-----------+
                         |
                    Eureka Server
                      (8761)

             Distributed Tracing
                    Zipkin
                    (9411)
```

## Technologies Used

### Backend
- Java 21
- Spring Boot 3.5.13
- Spring Cloud 2025.0.2
- Spring Cloud Gateway
- Netflix Eureka
- Resilience4j
- Spring Boot Actuator
- Micrometer Tracing
- OpenTelemetry
- Maven

### Frontend
- React
- JavaScript
- Vite
- CSS
- Lucide React

### Monitoring and Testing
- Zipkin
- Postman
- JUnit
- Spring Boot Test

## Microservices

| Service | Port | Responsibility |
|---|---:|---|
| Eureka Server | 8761 | Service discovery and registration |
| API Gateway | 8080 | Request routing and resilience |
| Product Service | 8081 | Product-related APIs |
| Inventory Service | 8082 | Inventory-related APIs |
| Recommendation Service | 8083 | Product recommendation APIs |
| React Dashboard | 5173 | User interface and monitoring |
| Zipkin | 9411 | Distributed tracing |

## Key Features

### 1. Service Discovery
Netflix Eureka enables microservices to register themselves and discover other services dynamically.

### 2. API Gateway
Spring Cloud Gateway provides a single entry point for client requests and routes them to the appropriate microservices.

### 3. Circuit Breaker
Resilience4j Circuit Breaker protects the application from repeated service failures.

It supports three states:

- **CLOSED:** Requests are allowed normally.
- **OPEN:** Requests are prevented from reaching the failing service.
- **HALF_OPEN:** A limited number of requests are allowed to test service recovery.

### 4. Fallback Mechanism
When the Recommendation Service becomes unavailable or fails, the Gateway returns a fallback response instead of exposing the downstream failure directly to the client.

### 5. Rate Limiter
Controls the number of incoming requests within a configured time window to prevent excessive traffic.

Current demonstration configuration:
- Request limit: 5 requests
- Time window: 10 seconds
- Excess requests: HTTP 429 – Too Many Requests

The current implementation uses an in-memory request counter.

### 6. Bulkhead
Resilience4j Bulkhead limits the number of concurrent operations to prevent resource exhaustion.

Current demonstration configuration:
- Maximum concurrent calls: 2
- Maximum wait duration: 0 ms

### 7. TimeLimiter
TimeLimiter restricts the time allowed for asynchronous operations and activates a fallback when the configured timeout is exceeded.

### 8. Distributed Tracing
Micrometer Tracing and Zipkin help track requests across the microservices and visualize distributed execution traces.

### 9. Monitoring Dashboard
The React dashboard provides a visual interface for checking service health and demonstrating resilience mechanisms.

## API Endpoints

All Gateway endpoints use port 8080.

### Product Service

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products` | Get all products |
| GET | `/api/products/1` | Get product by ID |

### Inventory Service

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/inventory/1` | Get inventory by product ID |

### Recommendation Service

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/recommendations` | Get recommendations |
| GET | `/api/recommendations/failure` | Simulate service failure |
| GET | `/api/recommendations/delay?seconds=3` | Simulate delayed response |

The following resilience endpoints can be tested directly against Recommendation Service on port 8083:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/recommendations/bulkhead?seconds=5` | Test Bulkhead |
| GET | `/api/recommendations/timelimit?seconds=4` | Test TimeLimiter |

### Gateway Testing URLs

```text
http://localhost:8080/api/products
http://localhost:8080/api/products/1
http://localhost:8080/api/inventory/1
http://localhost:8080/api/recommendations
http://localhost:8080/api/recommendations/failure
http://localhost:8080/api/recommendations/delay?seconds=3
```

## Prerequisites

Install the following before running the project:

- Java JDK 21
- Spring Tool Suite (STS) or another Java IDE
- Maven
- Node.js and npm
- Git
- Postman
- Zipkin server

## Project Setup

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
```

Navigate into the project directory.

### 2. Import Backend Projects

Import the following projects into Spring Tool Suite as existing Maven projects:

1. eureka-server
2. product-service
3. inventory-service
4. recommendation-service
5. api-gateway

Update Maven dependencies for each project.

### 3. Start Backend Services

Start the applications in this order:

1. Eureka Server
2. Product Service
3. Inventory Service
4. Recommendation Service
5. API Gateway

Open the Eureka dashboard:

http://localhost:8761

Verify that all services are registered and available.

### 4. Start Zipkin

Start your Zipkin server and open:

http://localhost:9411

### 5. Start Frontend

Navigate to the frontend directory:

```bash
cd frontend
npm install
npm run dev
```

Open:

http://localhost:5173

For Windows PowerShell, you can use:

```powershell
npm.cmd install
npm.cmd run dev
```

## Testing with Postman

Use Postman to verify the following:

| Test | Expected Result |
|---|---|
| Normal API requests | HTTP 200 |
| Single Failure | Gateway fallback |
| Multiple Failures | Circuit Breaker opens |
| Recovery | HALF_OPEN followed by CLOSED when successful |
| Delay Test | Slow-call detection |
| Rate Limiter | HTTP 429 after configured limit |
| Bulkhead | Excess concurrent calls trigger fallback |
| TimeLimiter | Timeout triggers fallback |
| Zipkin | Distributed traces are visible |

## Project Structure

```text
CircuitBreaker/
|
|-- eureka-server/
|
|-- api-gateway/
|   |-- src/main/java/
|   |-- src/main/resources/
|   |-- pom.xml
|
|-- product-service/
|
|-- inventory-service/
|
|-- recommendation-service/
|
|-- frontend/
|   |-- src/
|   |-- public/
|   |-- package.json
|
|-- README.md
```

## Future Enhancements

- JWT-based authentication and authorization
- Database integration for persistent product and inventory data
- Redis-based distributed rate limiting
- Docker and Docker Compose deployment
- CI/CD pipeline integration
- Advanced monitoring and alerting
- Cloud deployment and scalability improvements

## Learning Outcomes

This project demonstrates practical implementation of:

- Microservices architecture
- Service registration and discovery
- Centralized API Gateway routing
- Fault tolerance and resilience patterns
- Request rate control
- Concurrent request management
- Asynchronous timeout handling
- Distributed tracing
- Frontend and backend integration

## Conclusion

CircuitBreaker demonstrates how cloud-native microservices can improve application reliability through service discovery, centralized routing, fault tolerance, and distributed monitoring.

It provides a practical demonstration of resilience engineering concepts commonly used in distributed applications.

---

**Project:** CircuitBreaker – Cloud-Native E-Commerce API Gateway  
**Backend:** Java, Spring Boot, Spring Cloud  
**Frontend:** React, Vite  
**Resilience:** Resilience4j  
**Tracing:** Micrometer and Zipkin
