package com.circuitbreaker.gateway;

import java.util.UUID;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import reactor.core.publisher.Mono;

@Component
public class CorrelationIdFilter implements GlobalFilter, Ordered {

    public static final String CORRELATION_ID = "X-Correlation-ID";

    @Override
    public Mono<Void> filter(
            ServerWebExchange exchange,
            GatewayFilterChain chain) {

        String existingId = exchange.getRequest()
                .getHeaders()
                .getFirst(CORRELATION_ID);

        String requestId;

        if (existingId == null || existingId.isBlank()
                || existingId.length() > 100) {
            requestId = UUID.randomUUID().toString();
        } else {
            requestId = existingId;
        }

        // Add correlation ID to the request
        ServerWebExchange updatedExchange = exchange.mutate()
                .request(request -> request.headers(
                        headers -> headers.set(CORRELATION_ID, requestId)
                ))
                .build();

        // Add correlation ID to the response
        ServerHttpResponse response = updatedExchange.getResponse();
        response.getHeaders().set(CORRELATION_ID, requestId);

        System.out.println("Correlation ID: " + requestId);

        return chain.filter(updatedExchange);
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 10;
    }
}
