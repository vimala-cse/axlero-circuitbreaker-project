package com.circuitbreaker.product;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.circuitbreaker.product.ProductNotFoundException;

@Service
public class ProductService {

    private final List<Map<String, Object>> products = List.of(

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

    public List<Map<String, Object>> getAllProducts() {

        return products;
    }

    public Map<String, Object> getProductById(int id) {

        return products.stream()
                .filter(product ->
                    (int) product.get("id") == id
                )
                .findFirst()
                .orElseThrow(() ->
                    new ProductNotFoundException(
                        "Product not found with ID: " + id
                    )
                );
    }
}
