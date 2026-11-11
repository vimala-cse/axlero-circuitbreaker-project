package com.circuitbreaker.recommendation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class RecommendationResilienceServiceTest {

    private final RecommendationResilienceService service = new RecommendationResilienceService();

    @Test
    void returnsNormalRecommendations() {
        List<Map<String, Object>> recommendations = service.getRecommendations();
        assertEquals(3, recommendations.size());
        assertEquals("Mobile", recommendations.get(0).get("name"));
    }

    @Test
    void returnsBulkheadFallback() {
        List<Map<String, Object>> result = service.bulkheadFallback(5, new RuntimeException("bulkhead full"));
        assertEquals("Bulkhead Fallback", result.get(0).get("name"));
    }

    @Test
    void returnsTimeLimiterFallback() {
        List<Map<String, Object>> result = service.timeLimiterFallback(4, new RuntimeException("timeout")).join();
        assertEquals("TimeLimiter Fallback", result.get(0).get("name"));
        assertTrue(String.valueOf(result.get(0).get("reason")).contains("too long"));
    }
}
