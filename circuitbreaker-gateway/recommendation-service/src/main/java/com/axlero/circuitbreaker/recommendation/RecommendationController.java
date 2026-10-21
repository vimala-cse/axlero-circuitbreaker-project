package com.axlero.circuitbreaker.recommendation;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    @Value("${server.port}")
    private String port;

    private final ChaosState chaos;

    public RecommendationController(ChaosState chaos) {
        this.chaos = chaos;
    }

    // Week 2: before answering, check the chaos switch. In "normal"
    // mode this does nothing. In "slow" mode it waits first, and in
    // "fail" mode it throws an HTTP 500 - giving the gateway's circuit
    // breaker something real to react to. This simulates the Use Case
    // from the project guide: this service getting overwhelmed on a
    // high-traffic day.
    @GetMapping("/{productId}")
    public List<String> getRecommendations(@PathVariable String productId)
            throws InterruptedException {

        chaos.applyChaos();

        return switch (productId) {
            case "P-101" -> List.of("P-102", "P-103");
            case "P-102" -> List.of("P-101", "P-104");
            default -> List.of("P-101", "P-105");
        };
    }

    @GetMapping("/health")
    public String health() {
        return "recommendation-service OK on port " + port;
    }
}
