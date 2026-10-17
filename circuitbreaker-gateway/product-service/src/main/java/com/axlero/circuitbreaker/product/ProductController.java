package com.axlero.circuitbreaker.product;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    // Reads the actual port this instance is running on, so the
    // response can prove to us (and to the Chaos UI, later) exactly
    // which instance answered - useful once we have multiple
    // instances of a service behind the gateway.
    @Value("${server.port}")
    private String port;

    private static final List<Product> CATALOG = List.of(
            new Product("P-101", "Wireless Mouse", 799.0, "Electronics"),
            new Product("P-102", "Mechanical Keyboard", 3499.0, "Electronics"),
            new Product("P-103", "USB-C Hub", 1299.0, "Electronics"),
            new Product("P-104", "Laptop Stand", 1599.0, "Accessories"),
            new Product("P-105", "Noise Cancelling Headphones", 5999.0, "Electronics")
    );

    @GetMapping
    public List<Product> getAllProducts() {
        return CATALOG;
    }

    @GetMapping("/{id}")
    public Product getProduct(@PathVariable String id) {
        return CATALOG.stream()
                .filter(p -> p.getId().equals(id))
                .findFirst()
                .orElse(null);
    }

    // A tiny endpoint just to see, from the browser, which exact
    // instance (by port) handled a request.
    @GetMapping("/health")
    public String health() {
        return "product-service OK on port " + port;
    }
}
