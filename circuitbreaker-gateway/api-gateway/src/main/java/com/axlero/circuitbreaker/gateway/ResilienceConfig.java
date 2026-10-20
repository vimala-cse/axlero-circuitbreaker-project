package com.axlero.circuitbreaker.gateway;

import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.timelimiter.TimeLimiterConfig;
import org.springframework.cloud.circuitbreaker.resilience4j.ReactiveResilience4JCircuitBreakerFactory;
import org.springframework.cloud.client.circuitbreaker.Customizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

// The rules for the "recommendationCB" circuit breaker - the one that
// protects the /api/recommendations route (see application.yml).
//
// Think of it like the fuse in a house. These numbers decide when the
// fuse trips and when it tries to switch back on.
@Configuration
public class ResilienceConfig {

    @Bean
    public Customizer<ReactiveResilience4JCircuitBreakerFactory> recommendationBreakerCustomizer() {
        return factory -> factory.configure(builder -> builder
                .circuitBreakerConfig(CircuitBreakerConfig.custom()
                        // Look at the last 10 calls to judge health.
                        .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
                        .slidingWindowSize(10)
                        // Don't judge until at least 5 calls have happened,
                        // so one early failure can't trip it.
                        .minimumNumberOfCalls(5)
                        // If 50% or more of the calls in the window fail -> OPEN.
                        .failureRateThreshold(50)
                        // A call slower than 2 seconds counts as "slow".
                        // If 50% or more are slow -> OPEN as well.
                        .slowCallDurationThreshold(Duration.ofSeconds(2))
                        .slowCallRateThreshold(50)
                        // Stay OPEN for 10 seconds (all requests get the
                        // fallback instantly), then try again.
                        .waitDurationInOpenState(Duration.ofSeconds(10))
                        .automaticTransitionFromOpenToHalfOpenEnabled(true)
                        // HALF-OPEN: let 3 test calls through. If they go
                        // well -> CLOSED, otherwise back to OPEN.
                        .permittedNumberOfCallsInHalfOpenState(3)
                        .build())
                // Never wait more than 3 seconds for the service.
                // Past that, give up and use the fallback.
                .timeLimiterConfig(TimeLimiterConfig.custom()
                        .timeoutDuration(Duration.ofSeconds(3))
                        .build()),
                "recommendationCB");
    }
}
