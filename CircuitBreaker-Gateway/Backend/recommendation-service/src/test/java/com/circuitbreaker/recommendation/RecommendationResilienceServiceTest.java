package com.circuitbreaker.recommendation;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class RecommendationResilienceServiceTest {

    private final ProductCatalogClient productCatalogClient =
            mock(ProductCatalogClient.class);

    private final RecommendationResilienceService service =
            new RecommendationResilienceService(productCatalogClient);

    @Test
    void returnsAllProductsAsRecommendations() {

        List<Map<String, Object>> catalogue = List.of(
                Map.of(
                        "id", 1,
                        "name", "Laptop",
                        "category", "Electronics"
                ),
                Map.of(
                        "id", 2,
                        "name", "Mobile",
                        "category", "Electronics"
                ),
                Map.of(
                        "id", 3,
                        "name", "Gaming Chair",
                        "category", "Furniture"
                ),
                Map.of(
                        "id", 4,
                        "name", "Keyboard",
                        "category", "Accessories"
                )
        );

        when(productCatalogClient.getProducts())
                .thenReturn(catalogue);

        List<Map<String, Object>> recommendations =
                service.getRecommendations();

        assertEquals(catalogue.size(), recommendations.size());

        assertTrue(recommendations.stream()
                .anyMatch(product ->
                        "Gaming Chair".equals(product.get("name"))));

        assertTrue(recommendations.stream()
                .allMatch(product -> product.containsKey("reason")));
    }

    @Test
    void returnsBulkheadFallback() {

        List<Map<String, Object>> result =
                service.bulkheadFallback(
                        5,
                        new RuntimeException("bulkhead full")
                );

        assertEquals(
                "Bulkhead Fallback",
                result.get(0).get("name")
        );
    }

    @Test
    void returnsTimeLimiterFallback() {

        List<Map<String, Object>> result =
                service.timeLimiterFallback(
                        4,
                        new RuntimeException("timeout")
                ).join();

        assertEquals(
                "TimeLimiter Fallback",
                result.get(0).get("name")
        );

        assertTrue(
                String.valueOf(result.get(0).get("reason"))
                        .contains("too long")
        );
    }
}
