
package com.circuitbreaker.recommendation;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import org.springframework.stereotype.Service;

import io.github.resilience4j.bulkhead.annotation.Bulkhead;
import io.github.resilience4j.bulkhead.annotation.Bulkhead.Type;
import io.github.resilience4j.timelimiter.annotation.TimeLimiter;

@Service
public class RecommendationResilienceService {

    // NORMAL RECOMMENDATIONS
    public List<Map<String, Object>> getRecommendations() {

        return List.of(
            Map.of(
                "id", 2,
                "name", "Mobile",
                "reason", "Popular product"
            ),
            Map.of(
                "id", 3,
                "name", "Headphones",
                "reason", "Frequently purchased"
            ),
            Map.of(
                "id", 1,
                "name", "Laptop",
                "reason", "Trending product"
            )
        );
    }

    // WEEK 3: BULKHEAD
    @Bulkhead(
        name = "recommendationBulkhead",
        type = Type.SEMAPHORE,
        fallbackMethod = "bulkheadFallback"
    )
    public List<Map<String, Object>> getBulkheadRecommendations(
            int seconds) {

        System.out.println("Bulkhead request received");

        try {
            Thread.sleep(seconds * 1000L);

        } catch (InterruptedException e) {

            Thread.currentThread().interrupt();

            throw new RuntimeException(
                "Bulkhead request interrupted", e
            );
        }

        return getRecommendations();
    }

    // BULKHEAD FALLBACK
    public List<Map<String, Object>> bulkheadFallback(
            int seconds, Throwable throwable) {

        System.out.println(
            "Bulkhead activated: " + throwable.getMessage()
        );

        return List.of(
            Map.of(
                "id", 0,
                "name", "Bulkhead Fallback",
                "reason", "Too many simultaneous requests"
            )
        );
    }

    // WEEK 3: TIMELIMITER
    @TimeLimiter(
        name = "recommendationTimeLimiter",
        fallbackMethod = "timeLimiterFallback"
    )
    public CompletableFuture<List<Map<String, Object>>>
            getDelayedRecommendations(int seconds) {

        System.out.println("TimeLimiter request received");

        return CompletableFuture.supplyAsync(() -> {

            try {
                Thread.sleep(seconds * 1000L);

            } catch (InterruptedException e) {

                Thread.currentThread().interrupt();

                throw new RuntimeException(
                    "Recommendation request interrupted", e
                );
            }

            return getRecommendations();
        });
    }

    // TIMELIMITER FALLBACK
    public CompletableFuture<List<Map<String, Object>>>
            timeLimiterFallback(
                    int seconds, Throwable throwable) {

        System.out.println(
            "TimeLimiter activated: " + throwable.getMessage()
        );

        return CompletableFuture.completedFuture(
            List.of(
                Map.of(
                    "id", 0,
                    "name", "TimeLimiter Fallback",
                    "reason",
                    "Recommendation request took too long"
                )
            )
        );
    }
}
