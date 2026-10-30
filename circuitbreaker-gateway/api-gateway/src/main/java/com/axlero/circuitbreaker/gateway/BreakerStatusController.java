package com.axlero.circuitbreaker.gateway;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Lets the dashboard read the REAL circuit breaker state
// (CLOSED / OPEN / HALF_OPEN) straight from Resilience4j.
// URL: http://localhost:8080/gateway/breakers
@RestController
public class BreakerStatusController {

    private final ObjectProvider<CircuitBreakerRegistry> registry;

    public BreakerStatusController(ObjectProvider<CircuitBreakerRegistry> registry) {
        this.registry = registry;
    }

    @GetMapping("/gateway/breakers")
    public List<Map<String, Object>> breakers() {
        List<Map<String, Object>> out = new ArrayList<>();
        CircuitBreakerRegistry reg = registry.getIfAvailable();
        if (reg == null) {
            return out;
        }
        for (CircuitBreaker cb : reg.getAllCircuitBreakers()) {
            CircuitBreaker.Metrics m = cb.getMetrics();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", cb.getName());
            row.put("state", cb.getState().name());
            row.put("failureRate", m.getFailureRate());          // -1 until enough calls
            row.put("slowCallRate", m.getSlowCallRate());        // -1 until enough calls
            row.put("bufferedCalls", m.getNumberOfBufferedCalls());
            row.put("failedCalls", m.getNumberOfFailedCalls());
            row.put("notPermittedCalls", m.getNumberOfNotPermittedCalls());
            out.add(row);
        }
        return out;
    }
}
