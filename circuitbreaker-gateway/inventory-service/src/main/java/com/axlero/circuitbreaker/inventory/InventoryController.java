package com.axlero.circuitbreaker.inventory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    @Value("${server.port}")
    private String port;

    // product id -> units in stock. In-memory is fine for this project -
    // the point is demonstrating resilience patterns across services,
    // not building a real inventory database.
    private static final Map<String, Integer> STOCK = new ConcurrentHashMap<>(Map.of(
            "P-101", 42,
            "P-102", 15,
            "P-103", 0,
            "P-104", 23,
            "P-105", 7
    ));

    @GetMapping
    public Map<String, Integer> getAllStock() {
        return STOCK;
    }

    @GetMapping("/{productId}")
    public int getStock(@PathVariable String productId) {
        return STOCK.getOrDefault(productId, 0);
    }

    @GetMapping("/health")
    public String health() {
        return "inventory-service OK on port " + port;
    }
}
