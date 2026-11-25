package com.circuitbreaker.inventory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InventoryService {

    private final ProductCatalogClient productCatalogClient;

    private final Map<Integer, Map<String, Object>> inventoryMap =
            new LinkedHashMap<>();

    // Initial stock for existing sample products
    private final Map<String, Integer> initialStock = Map.of(
            "Laptop", 20,
            "Mobile", 0,
            "Headphones", 50
    );

    public InventoryService(ProductCatalogClient productCatalogClient) {
        this.productCatalogClient = productCatalogClient;
    }

    // Get all products and their inventory
    public synchronized List<Map<String, Object>> getAllInventory() {

        refreshInventory();

        List<Map<String, Object>> result = new ArrayList<>();

        for (Map<String, Object> item : inventoryMap.values()) {
            result.add(new LinkedHashMap<>(item));
        }

        return result;
    }

    // Get inventory by product ID
    public synchronized Map<String, Object> getInventoryByProductId(
            int productId) {

        refreshInventory();

        Map<String, Object> inventory = inventoryMap.get(productId);

        if (inventory == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Inventory not found for product " + productId
            );
        }

        return new LinkedHashMap<>(inventory);
    }

    // Update stock quantity
    public synchronized Map<String, Object> updateStock(
            int productId, int quantity) {

        if (quantity < 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Stock quantity cannot be negative"
            );
        }

        refreshInventory();

        Map<String, Object> inventory = inventoryMap.get(productId);

        if (inventory == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Inventory not found for product " + productId
            );
        }

        inventory.put("stock", quantity);
        inventory.put("available", quantity > 0);

        return new LinkedHashMap<>(inventory);
    }

    // Synchronize inventory with Product Service
    private void refreshInventory() {

        List<Map<String, Object>> products =
                productCatalogClient.getProducts();

        for (Map<String, Object> product : products) {

            Object idValue = product.get("id");
            Object nameValue = product.get("name");

            if (!(idValue instanceof Number) || nameValue == null) {
                continue;
            }

            int productId = ((Number) idValue).intValue();
            String productName = String.valueOf(nameValue);

            // Create inventory only when product is new
            if (!inventoryMap.containsKey(productId)) {

                int stock = initialStock.getOrDefault(
                        productName, 0
                );

                Map<String, Object> inventory =
                        new LinkedHashMap<>();

                inventory.put("productId", productId);
                inventory.put("productName", productName);
                inventory.put("stock", stock);
                inventory.put("available", stock > 0);

                inventoryMap.put(productId, inventory);
            }
        }
    }
}
