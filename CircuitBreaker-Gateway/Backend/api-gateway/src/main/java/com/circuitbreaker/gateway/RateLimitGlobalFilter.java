package com.circuitbreaker.gateway;

import java.net.InetSocketAddress;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import reactor.core.publisher.Mono;

@Component
public class RateLimitGlobalFilter implements GlobalFilter, Ordered {

    private static final int REQUEST_LIMIT = 5;
    private static final long WINDOW_MILLIS = 10_000;

    private final ConcurrentMap<String, Window> requestCounts =
            new ConcurrentHashMap<>();

    @Override
    public Mono<Void> filter(
            ServerWebExchange exchange,
            GatewayFilterChain chain) {

        String path = exchange.getRequest().getURI().getPath();

        // Apply rate limiting only to Recommendation API
        if (!path.startsWith("/api/recommendations")) {
            return chain.filter(exchange);
        }

        InetSocketAddress address =
                exchange.getRequest().getRemoteAddress();

        String clientIp = address != null
                ? address.getAddress().getHostAddress()
                : "unknown";

        long now = System.currentTimeMillis();

        Window window = requestCounts.compute(clientIp, (key, current) -> {

            if (current == null ||
                    now - current.startTime() >= WINDOW_MILLIS) {
                return new Window(now, 1);
            }

            return new Window(
                current.startTime(),
                current.count() + 1
            );
        });

        if (window.count() > REQUEST_LIMIT) {

            System.out.println("Rate limit exceeded for " + clientIp);

            exchange.getResponse().setStatusCode(
                HttpStatus.TOO_MANY_REQUESTS
            );

            exchange.getResponse().getHeaders()
                    .add("Retry-After", "10");

            return exchange.getResponse().setComplete();
        }

        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return -1;
    }

    private record Window(long startTime, int count) {
    }
}
