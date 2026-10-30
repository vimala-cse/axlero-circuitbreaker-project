package com.circuitbreaker.gateway;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/fallback")
public class FallbackController {

    @GetMapping("/recommendations")
    public Map<String, Object> recommendationFallback() {

        System.out.println(
            "Recommendation Service is unavailable. Fallback activated.");

        List<Map<String, Object>> topSellers = List.of(

            Map.of(
                "id", 1,
                "name", "Laptop",
                "reason", "Top Selling Product"
            ),

            Map.of(
                "id", 2,
                "name", "Mobile",
                "reason", "Popular Product"
            ),

            Map.of(
                "id", 3,
                "name", "Headphones",
                "reason", "Customer Favourite"
            )
        );

        return Map.of(
            "status", "FALLBACK",
            "message", "Recommendation Service is temporarily unavailable",
            "recommendations", topSellers
        );
    }
}
