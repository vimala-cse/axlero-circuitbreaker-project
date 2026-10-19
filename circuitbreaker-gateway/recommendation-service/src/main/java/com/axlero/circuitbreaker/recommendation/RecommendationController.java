package com.axlero.circuitbreaker.recommendation;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    @Value("${server.port}")
    private String port;

    // Week 1: this just returns normally, same as the other two
    // services. From Week 2 we add a "chaos" flag here (configurable
    // via an endpoint / env var) that makes this method sleep or throw,
    // so the Gateway's Circuit Breaker has something real to trip on -
    // simulating the Use Case in the project guide: this service
    // getting overwhelmed on a high-traffic day.
    @GetMapping("/{productId}")
    public List<String> getRecommendations(@PathVariable String productId) {
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
