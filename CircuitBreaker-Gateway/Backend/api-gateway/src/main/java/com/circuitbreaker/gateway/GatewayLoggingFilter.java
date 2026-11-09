package com.circuitbreaker.gateway;

import java.time.Duration;
import java.time.Instant;

import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;

import org.springframework.web.server.ServerWebExchange;

import reactor.core.publisher.Mono;

@Component
public class GatewayLoggingFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(
            ServerWebExchange exchange,
            org.springframework.cloud.gateway.filter.GatewayFilterChain chain) {

        Instant startTime = Instant.now();

        String method = exchange.getRequest()
                .getMethod()
                .name();

        String path = exchange.getRequest()
                .getURI()
                .getPath();

        String correlationId = exchange.getRequest()
                .getHeaders()
                .getFirst("X-Correlation-ID");

        System.out.println("--------------------------------");
        System.out.println("Incoming Request");
        System.out.println("Method: " + method);
        System.out.println("Path: " + path);
        System.out.println("Correlation ID: " + correlationId);

        return chain.filter(exchange)
                .doFinally(signal -> {

                    long duration = Duration.between(
                            startTime,
                            Instant.now()
                    ).toMillis();

                    Integer status = exchange.getResponse()
                            .getStatusCode() == null
                            ? null
                            : exchange.getResponse()
                                    .getStatusCode()
                                    .value();

                    System.out.println("Response Status: " + status);
                    System.out.println("Processing Time: "
                            + duration + " ms");
                    System.out.println("--------------------------------");
                });
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 20;
    }
}
