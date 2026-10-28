package com.circuitbreaker.product;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    @GetMapping
    public List<Map<String, Object>> getProducts() {

        return List.of(
            Map.of(
                "id", 1,
                "name", "Laptop",
                "price", 55000
            ),
            Map.of(
                "id", 2,
                "name", "Mobile",
                "price", 25000
            ),
            Map.of(
                "id", 3,
                "name", "Headphones",
                "price", 2000
            )
        );
    }

    @GetMapping("/{id}")
    public Map<String, Object> getProduct(@PathVariable int id) {

        if (id == 1) {
            return Map.of(
                "id", 1,
                "name", "Laptop",
                "price", 55000
            );
        }

        if (id == 2) {
            return Map.of(
                "id", 2,
                "name", "Mobile",
                "price", 25000
            );
        }

        if (id == 3) {
            return Map.of(
                "id", 3,
                "name", "Headphones",
                "price", 2000
            );
        }

        throw new org.springframework.web.server.ResponseStatusException(
            org.springframework.http.HttpStatus.NOT_FOUND,
            "Product not found"
        );
    }
}
