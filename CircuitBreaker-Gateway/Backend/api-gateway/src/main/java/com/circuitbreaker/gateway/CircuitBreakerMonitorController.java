package com.circuitbreaker.gateway;

import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

@RestController
public class CircuitBreakerMonitorController {

    private final CircuitBreakerRegistry circuitBreakerRegistry;
    private final MeterRegistry meterRegistry;

    // Constructor used by Spring Boot
    @Autowired
    public CircuitBreakerMonitorController(
            CircuitBreakerRegistry circuitBreakerRegistry,
            MeterRegistry meterRegistry) {

        this.circuitBreakerRegistry = circuitBreakerRegistry;
        this.meterRegistry = meterRegistry;
    }

    // Constructor preserved for existing unit tests
    public CircuitBreakerMonitorController(
            CircuitBreakerRegistry circuitBreakerRegistry) {

        this(circuitBreakerRegistry, new SimpleMeterRegistry());
    }

    // Existing endpoint: Circuit Breaker details
    @GetMapping("/monitor/circuit-breaker")
    public Map<String, Object> getRecommendationCircuitBreakerState() {

        CircuitBreaker breaker = circuitBreakerRegistry
                .circuitBreaker("recommendationCircuitBreaker");

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

    // New endpoint: Overall Gateway monitoring
    @GetMapping("/monitor/overview")
    public Map<String, Object> getMonitoringOverview() {

        long totalRequests = 0;
        long errorRequests = 0;
        double totalResponseTime = 0;

        for (Timer timer : meterRegistry.find("http.server.requests").timers()) {

            long count = timer.count();

            totalRequests += count;

            totalResponseTime += timer.totalTime(TimeUnit.MILLISECONDS);

            String status = timer.getId().getTag("status");

            if (status != null &&
                    (status.startsWith("4") || status.startsWith("5"))) {

                errorRequests += count;
            }
        }

        double averageResponseTime = totalRequests == 0
                ? 0
                : totalResponseTime / totalRequests;

        double errorRate = totalRequests == 0
                ? 0
                : (errorRequests * 100.0) / totalRequests;

        CircuitBreaker breaker = circuitBreakerRegistry
                .circuitBreaker("recommendationCircuitBreaker");

        CircuitBreaker.Metrics breakerMetrics = breaker.getMetrics();

        long memoryUsed = ManagementFactory.getMemoryMXBean()
                .getHeapMemoryUsage().getUsed();

        long memoryMax = ManagementFactory.getMemoryMXBean()
                .getHeapMemoryUsage().getMax();

        Map<String, Object> circuitData = new LinkedHashMap<>();

        circuitData.put("name", breaker.getName());
        circuitData.put("state", breaker.getState().name());
        circuitData.put("failureRate", breakerMetrics.getFailureRate());
        circuitData.put("slowCallRate", breakerMetrics.getSlowCallRate());
        circuitData.put("failedCalls", breakerMetrics.getNumberOfFailedCalls());
        circuitData.put("successfulCalls", breakerMetrics.getNumberOfSuccessfulCalls());
        circuitData.put("rejectedCalls", breakerMetrics.getNumberOfNotPermittedCalls());

        Map<String, Object> result = new LinkedHashMap<>();

        result.put("timestamp", Instant.now().toString());
        result.put("gatewayUptimeSeconds",
                ManagementFactory.getRuntimeMXBean().getUptime() / 1000);

        result.put("totalRequests", totalRequests);
        result.put("errorRequests", errorRequests);

        result.put("errorRatePercent",
                Math.round(errorRate * 100.0) / 100.0);

        result.put("averageResponseTimeMs",
                Math.round(averageResponseTime * 100.0) / 100.0);

        result.put("jvmMemoryUsedMb",
                Math.round(memoryUsed / (1024.0 * 1024.0) * 100.0) / 100.0);

        result.put("jvmMemoryMaxMb",
                memoryMax < 0
                        ? -1
                        : Math.round(memoryMax / (1024.0 * 1024.0) * 100.0) / 100.0);

        result.put("circuitBreaker", circuitData);

        return result;
    }
}