package com.circuitbreaker.product;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.stereotype.Service;

@Service
public class ProductService {

    private final List<Map<String, Object>> products = new ArrayList<>();

    // IDs are generated automatically
    private final AtomicInteger idGenerator = new AtomicInteger(0);

    public ProductService() {

        addProduct("Laptop", "Electronics",
                55000, "High-performance laptop");

        addProduct("Mobile", "Electronics",
                25000, "Latest smartphone");

        addProduct("Headphones", "Accessories",
                2000, "Wireless Bluetooth headphones");

        addProduct("Smart Watch", "Wearables",
                4500, "Smart fitness watch");

        addProduct("Keyboard", "Accessories",
                1500, "Mechanical keyboard");

        addProduct("Wireless Mouse", "Accessories",
                900, "Wireless computer mouse");

        addProduct("Monitor", "Electronics",
                12000, "Full HD computer monitor");

        addProduct("Tablet", "Electronics",
                18000, "Portable Android tablet");

        addProduct("Bluetooth Speaker", "Accessories",
                3000, "Portable Bluetooth speaker");

        addProduct("Power Bank", "Accessories",
                1800, "Fast charging power bank");
    }

    public synchronized List<Map<String, Object>> getAllProducts() {
        return new ArrayList<>(products);
    }

    public synchronized Map<String, Object> getProductById(int id) {

        return products.stream()
                .filter(product ->
                    ((Number) product.get("id")).intValue() == id)
                .findFirst()
                .orElseThrow(() ->
                    new ProductNotFoundException(
                        "Product not found with ID: " + id));
    }

    public synchronized Map<String, Object> addProduct(
            String name,
            String category,
            double price,
            String description) {

        Map<String, Object> product = new LinkedHashMap<>();

        // Automatically generate the next ID
        product.put("id", idGenerator.incrementAndGet());
        product.put("name", name);
        product.put("category", category);
        product.put("price", price);
        product.put("description", description);

        products.add(product);

        return product;
    }
}
