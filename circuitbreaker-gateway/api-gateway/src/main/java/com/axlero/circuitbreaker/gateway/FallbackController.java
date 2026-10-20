package com.axlero.circuitbreaker.gateway;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// This is the "Plan B" answer. When the circuit breaker is OPEN (or the
// recommendation service is too slow / failing), the gateway does NOT
// call that service. It forwards the request here and we answer
// instantly with a safe, pre-made list of "Top Sellers".
//
// The shopper still sees a "You may also like" section, the page loads
// fast, and nothing hangs - exactly the Use Case from the project guide.
@RestController
@RequestMapping("/fallback")
public class FallbackController {

    @GetMapping("/recommendations")
    public Map<String, Object> recommendationsFallback() {
        Map<String, Object> body = new LinkedHashMap<>();
        // "fallback": true lets the dashboard (and anyone testing) tell
        // this apart from a real answer from recommendation-service.
        body.put("fallback", true);
        body.put("source", "api-gateway");
        body.put("message", "Recommendation service is unavailable. Showing Top Sellers instead.");
        body.put("recommendations", List.of("P-105", "P-102", "P-101"));
        return body;
    }
}
