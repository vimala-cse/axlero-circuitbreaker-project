package com.circuitbreaker.recommendation;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    @GetMapping
    public List<Map<String, Object>> getRecommendations() {

        System.out.println("Recommendation request received");

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
            )
        );
    }
}
