package com.circuitbreaker.inventory;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InventoryService {

    private final List<Map<String, Object>> inventoryList = List.of(

        Map.of(
            "productId", 1,
            "productName", "Laptop",
            "stock", 20,
            "available", true
        ),

        Map.of(
            "productId", 2,
            "productName", "Mobile",
            "stock", 0,
            "available", false
        ),

        Map.of(
            "productId", 3,
            "productName", "Headphones",
            "stock", 50,
            "available", true
        )
    );

    public Map<String, Object> getInventoryByProductId(int productId) {

        return inventoryList.stream()
                .filter(item ->
                    (int) item.get("productId") == productId
                )
                .findFirst()
                .orElseThrow(() ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Inventory not found for product " + productId
                    )
                );
    }
}
