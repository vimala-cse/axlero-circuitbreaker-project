package com.circuitbreaker.gateway;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;

@RestController
public class CircuitBreakerMonitorController {

    private final CircuitBreakerRegistry circuitBreakerRegistry;

    public CircuitBreakerMonitorController(CircuitBreakerRegistry circuitBreakerRegistry) {
        this.circuitBreakerRegistry = circuitBreakerRegistry;
    }

    @GetMapping("/monitor/circuit-breaker")
    public Map<String, Object> getRecommendationCircuitBreakerState() {
        CircuitBreaker breaker = circuitBreakerRegistry.circuitBreaker("recommendationCircuitBreaker");
        CircuitBreaker.Metrics metrics = breaker.getMetrics();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("name", breaker.getName());
        result.put("state", breaker.getState().name());
        result.put("failureRate", metrics.getFailureRate());
        result.put("slowCallRate", metrics.getSlowCallRate());
        result.put("numberOfBufferedCalls", metrics.getNumberOfBufferedCalls());
        result.put("numberOfFailedCalls", metrics.getNumberOfFailedCalls());
        result.put("numberOfSuccessfulCalls", metrics.getNumberOfSuccessfulCalls());
        result.put("numberOfSlowCalls", metrics.getNumberOfSlowCalls());
        result.put("numberOfNotPermittedCalls", metrics.getNumberOfNotPermittedCalls());
        return result;
    }
}
