package com.axlero.circuitbreaker.gateway;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

// Lets the dashboard show the real numbers of the rate limiter and the
// bulkhead.   URL: http://localhost:8080/gateway/protection
@RestController
public class ProtectionController {

    private final RateLimiterFilter rateLimiter;
    private final BulkheadFilter bulkhead;

    public ProtectionController(RateLimiterFilter rateLimiter, BulkheadFilter bulkhead) {
        this.rateLimiter = rateLimiter;
        this.bulkhead = bulkhead;
    }

    @GetMapping("/gateway/protection")
    public Map<String, Object> protection() {
        Map<String, Object> rate = new LinkedHashMap<>();
        rate.put("enabled", true);
        rate.put("limitPerSecond", rateLimiter.getLimitPerSecond());
        rate.put("allowed", rateLimiter.getAllowed());
        rate.put("rejected", rateLimiter.getRejected());

        Map<String, Object> bulk = new LinkedHashMap<>();
        bulk.put("enabled", true);
        bulk.put("maxConcurrent", bulkhead.getMaxConcurrent());
        bulk.put("inUse", bulkhead.getInUse());
        bulk.put("rejected", bulkhead.getRejected());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("rateLimiter", rate);
        out.put("bulkhead", bulk);
        return out;
    }
}
