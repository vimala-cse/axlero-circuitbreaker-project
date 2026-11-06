package com.axlero.circuitbreaker.gateway;

import io.github.resilience4j.bulkhead.Bulkhead;
import io.github.resilience4j.bulkhead.BulkheadConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

// BULKHEAD (Week 3)
// A ship has sealed compartments so one leak does not sink the whole
// ship. Here, the Recommendation route may hold only a few requests at
// the same time. When a slow Recommendation service fills those slots,
// extra requests are turned away at once with "503", instead of piling
// up and using every thread of the gateway. Product and Inventory
// routes keep working normally.
@Component
public class BulkheadFilter implements GlobalFilter, Ordered {

    private static final String PROTECTED_PATH = "/api/recommendations";

    private final Bulkhead bulkhead;
    private final AtomicLong rejected = new AtomicLong();

    public BulkheadFilter(@Value("${protection.bulkhead.max-concurrent:5}") int maxConcurrent) {
        BulkheadConfig config = BulkheadConfig.custom()
                .maxConcurrentCalls(maxConcurrent)
                .maxWaitDuration(Duration.ZERO) // do not wait for a free slot
                .build();
        this.bulkhead = Bulkhead.of("recommendation-bulkhead", config);
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        if (!path.startsWith(PROTECTED_PATH)) {
            return chain.filter(exchange);
        }

        if (!bulkhead.tryAcquirePermission()) {
            rejected.incrementAndGet();
            return Rejection.write(exchange, HttpStatus.SERVICE_UNAVAILABLE,
                    "Recommendation route is busy. Try again shortly.");
        }

        // Free the slot when the request finishes, whatever the result.
        return chain.filter(exchange).doFinally(signal -> bulkhead.onComplete());
    }

    public int getMaxConcurrent() {
        return bulkhead.getBulkheadConfig().getMaxConcurrentCalls();
    }

    public int getInUse() {
        return getMaxConcurrent() - bulkhead.getMetrics().getAvailableConcurrentCalls();
    }

    public long getRejected() {
        return rejected.get();
    }

    @Override
    public int getOrder() {
        return -9; // right after the rate limiter
    }
}
