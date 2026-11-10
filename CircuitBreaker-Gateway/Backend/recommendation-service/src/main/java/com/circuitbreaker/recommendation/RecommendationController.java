
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

    // Normal recommendations
    @GetMapping
    public List<Map<String, Object>> getRecommendations() {
        return resilienceService.getRecommendations();
    }

    // WEEK 2: Failure simulation
    @GetMapping("/failure")
    public Map<String, Object> simulateFailure() {

        System.out.println(
            "Simulating Recommendation Service failure"
        );

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

    // Delay simulation
    @GetMapping("/delay")
    public String delay(
            @RequestParam(defaultValue = "3") int seconds) {

        validateSeconds(seconds);

        try {
            Thread.sleep(seconds * 1000L);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();

            throw new ResponseStatusException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Recommendation delay was interrupted"
            );
        }

        return "Recommendation response completed after "
                + seconds + " seconds";
    }

    // Common validation
    private void validateSeconds(int seconds) {

        if (seconds < 0 || seconds > 10) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Seconds must be between 0 and 10"
            );
        }
    }
}
