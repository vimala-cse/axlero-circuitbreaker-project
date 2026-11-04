package com.axlero.circuitbreaker.gateway;

import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

// RATE LIMITER (Week 3)
// Every visitor (identified by IP address) gets their own allowance of
// requests per second. If a visitor sends more than that, the gateway
// answers "429 Too Many Requests" immediately and the request never
// reaches the microservices. This protects the system from scraping
// and from a flood of requests.
//
// Only paths starting with /api/ are limited. Health checks, the chaos
// switch and the dashboard helper endpoints are left alone.
@Component
public class RateLimiterFilter implements GlobalFilter, Ordered {

    private final int limitPerSecond;
    private final Map<String, RateLimiter> limiters = new ConcurrentHashMap<>();
    private final AtomicLong allowed = new AtomicLong();
    private final AtomicLong rejected = new AtomicLong();

    public RateLimiterFilter(@Value("${protection.rate-limit.per-second:20}") int limitPerSecond) {
        this.limitPerSecond = limitPerSecond;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        if (!path.startsWith("/api/")) {
            return chain.filter(exchange);
        }

        RateLimiter limiter = limiters.computeIfAbsent(clientOf(exchange), this::newLimiter);
        if (limiter.acquirePermission()) {
            allowed.incrementAndGet();
            return chain.filter(exchange);
        }

        rejected.incrementAndGet();
        exchange.getResponse().getHeaders().add("Retry-After", "1");
        return Rejection.write(exchange, HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Slow down.");
    }

    private RateLimiter newLimiter(String client) {
        RateLimiterConfig config = RateLimiterConfig.custom()
                .limitForPeriod(limitPerSecond)
                .limitRefreshPeriod(Duration.ofSeconds(1))
                .timeoutDuration(Duration.ZERO) // do not wait, reject at once
                .build();
        return RateLimiter.of("client-" + client, config);
    }

    private String clientOf(ServerWebExchange exchange) {
        InetSocketAddress address = exchange.getRequest().getRemoteAddress();
        return address == null || address.getAddress() == null
                ? "unknown"
                : address.getAddress().getHostAddress();
    }

    public int getLimitPerSecond() {
        return limitPerSecond;
    }

    public long getAllowed() {
        return allowed.get();
    }

    public long getRejected() {
        return rejected.get();
    }

    @Override
    public int getOrder() {
        return -10; // run before the circuit breaker and routing
    }
}
