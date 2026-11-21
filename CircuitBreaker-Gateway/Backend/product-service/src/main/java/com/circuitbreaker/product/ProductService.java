package com.circuitbreaker.product;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.stereotype.Service;

@Service
public class ProductService {

    private final List<Map<String, Object>> products =
            new ArrayList<>();

    private final AtomicInteger idGenerator =
            new AtomicInteger(10);

    public ProductService() {

        // Initial product catalogue

        addSampleProduct(1, "Laptop", "Electronics",
                55000, "High-performance laptop");

        addSampleProduct(2, "Mobile", "Electronics",
                25000, "Latest smartphone");

        addSampleProduct(3, "Headphones", "Accessories",
                2000, "Wireless Bluetooth headphones");

        addSampleProduct(4, "Smart Watch", "Wearables",
                4500, "Smart fitness watch");

        addSampleProduct(5, "Keyboard", "Accessories",
                1500, "Mechanical keyboard");

        addSampleProduct(6, "Wireless Mouse", "Accessories",
                900, "Wireless computer mouse");

        addSampleProduct(7, "Monitor", "Electronics",
                12000, "Full HD computer monitor");

        addSampleProduct(8, "Tablet", "Electronics",
                18000, "Portable Android tablet");

        addSampleProduct(9, "Bluetooth Speaker", "Accessories",
                3000, "Portable Bluetooth speaker");

        addSampleProduct(10, "Power Bank", "Accessories",
                1800, "Fast charging power bank");
    }

    private void addSampleProduct(
            int id,
            String name,
            String category,
            double price,
            String description) {

        Map<String, Object> product = new LinkedHashMap<>();

        product.put("id", id);
        product.put("name", name);
        product.put("category", category);
        product.put("price", price);
        product.put("description", description);

        products.add(product);
    }

    // Get all products

    public synchronized List<Map<String, Object>> getAllProducts() {

        return new ArrayList<>(products);
    }

    // Get product by ID

    public synchronized Map<String, Object> getProductById(int id) {

        return products.stream()
                .filter(product ->
                    ((Number) product.get("id")).intValue() == id
                )
                .findFirst()
                .orElseThrow(() ->
                    new ProductNotFoundException(
                        "Product not found with ID: " + id
                    )
                );
    }

    // Add a new product

    public synchronized Map<String, Object> addProduct(
            String name,
            String category,
            double price,
            String description) {

        Map<String, Object> product = new LinkedHashMap<>();

        product.put("id", idGenerator.incrementAndGet());
        product.put("name", name);
        product.put("category", category);
        product.put("price", price);
        product.put("description", description);

        products.add(product);

        return product;
    }
}
