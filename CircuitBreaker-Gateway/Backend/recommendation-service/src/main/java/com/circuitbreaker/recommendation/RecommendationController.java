package com.circuitbreaker.recommendation;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    // Normal Recommendation API
    @GetMapping
    public List<Map<String, Object>> getRecommendations() {

        System.out.println("Recommendation request received");

        return getSampleRecommendations();
    }

    // Simulate Slow Response
    @GetMapping("/delay")
    public List<Map<String, Object>> simulateDelay(
            @RequestParam(defaultValue = "3") int seconds) {

        if (seconds < 0 || seconds > 10) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Delay must be between 0 and 10 seconds"
            );
        }

        System.out.println(
            "Simulating Recommendation Service delay: "
            + seconds + " seconds"
        );

        try {
            Thread.sleep(seconds * 1000L);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();

            throw new ResponseStatusException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Request interrupted"
            );
        }

        return getSampleRecommendations();
    }

    // Simulate Service Failure
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

    // Sample Recommendation Data
    private List<Map<String, Object>> getSampleRecommendations() {

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
}
