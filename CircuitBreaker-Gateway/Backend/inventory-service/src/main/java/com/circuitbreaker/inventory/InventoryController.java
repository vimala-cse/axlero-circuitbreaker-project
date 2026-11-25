package com.circuitbreaker.inventory;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    // Get all products with stock information
    @GetMapping
    public List<Map<String, Object>> getAllInventory() {
        return inventoryService.getAllInventory();
    }

    // Get inventory for an individual product
    @GetMapping("/{productId}")
    public Map<String, Object> getInventory(
            @PathVariable int productId) {

        return inventoryService.getInventoryByProductId(productId);
    }

    // Update product stock
    @PatchMapping("/{productId}/stock")
    public Map<String, Object> updateStock(
            @PathVariable int productId,
            @RequestBody Map<String, Integer> request) {

        Integer quantity = request.get("stock");

        if (quantity == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Stock quantity is required"
            );
        }

        return inventoryService.updateStock(productId, quantity);
    }
}
