package com.circuitbreaker.recommendation;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    private final RecommendationResilienceService resilienceService;

    public RecommendationController(
            RecommendationResilienceService resilienceService) {
        this.resilienceService = resilienceService;
    }

    @GetMapping
    public List<Map<String, Object>> getRecommendations() {

        return List.of(
            Map.of("id", 2, "name", "Mobile", "reason", "Popular product"),
            Map.of("id", 3, "name", "Headphones", "reason", "Frequently purchased"),
            Map.of("id", 1, "name", "Laptop", "reason", "Trending product")
        );
    }

    // WEEK 2: Failure simulation
    @GetMapping("/failure")
    public Map<String, Object> simulateFailure() {

        System.out.println("Simulating Recommendation Service failure");

        throw new ResponseStatusException(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "Simulated Recommendation Service failure"
        );
    }

    // WEEK 3: Bulkhead
    @GetMapping("/bulkhead")
    public List<Map<String, Object>> bulkhead(
            @RequestParam(defaultValue = "5") int seconds) {

        validateSeconds(seconds);

        return resilienceService.getBulkheadRecommendations(seconds);
    }

    // WEEK 3: TimeLimiter
    @GetMapping("/timelimit")
    public CompletableFuture<List<Map<String, Object>>> timeLimit(
            @RequestParam(defaultValue = "4") int seconds) {

        validateSeconds(seconds);

        return resilienceService.getDelayedRecommendations(seconds);
    }
    
    @GetMapping("/delay")
    public String delay(@RequestParam(defaultValue = "3") int seconds)
            throws InterruptedException {

        if (seconds < 1 || seconds > 10) {
            throw new IllegalArgumentException(
                "Seconds must be between 1 and 10");
        }

        Thread.sleep(seconds * 1000L);

        return "Recommendation response completed after "
                + seconds + " seconds";
    }

    private void validateSeconds(int seconds) {

        if (seconds < 0 || seconds > 10) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Seconds must be between 0 and 10"
            );
        }
    }
}