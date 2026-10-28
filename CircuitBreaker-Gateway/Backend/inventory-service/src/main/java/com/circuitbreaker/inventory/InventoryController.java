package com.circuitbreaker.inventory;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    @GetMapping("/{productId}")
    public Map<String, Object> getInventory(
            @PathVariable int productId) {

        if (productId == 1) {
            return Map.of(
                "productId", 1,
                "productName", "Laptop",
                "stock", 20,
                "available", true
            );
        }

        if (productId == 2) {
            return Map.of(
                "productId", 2,
                "productName", "Mobile",
                "stock", 0,
                "available", false
            );
        }

        if (productId == 3) {
            return Map.of(
                "productId", 3,
                "productName", "Headphones",
                "stock", 50,
                "available", true
            );
        }

        throw new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "Inventory not found for product " + productId
        );
    }
}
