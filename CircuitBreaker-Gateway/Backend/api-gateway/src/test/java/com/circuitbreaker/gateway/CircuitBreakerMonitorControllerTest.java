package com.circuitbreaker.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;

class CircuitBreakerMonitorControllerTest {

    @Test
    void reportsInitialCircuitBreakerState() {
        CircuitBreakerRegistry registry = CircuitBreakerRegistry.ofDefaults();
        registry.circuitBreaker("recommendationCircuitBreaker");

        CircuitBreakerMonitorController controller = new CircuitBreakerMonitorController(registry);

        assertEquals("CLOSED", controller.getRecommendationCircuitBreakerState().get("state"));
    }
}
