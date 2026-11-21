package com.circuitbreaker.product;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    // Get all products

    @GetMapping
    public List<Map<String, Object>> getProducts() {

        return productService.getAllProducts();
    }

    // Get product by ID

    @GetMapping("/{id}")
    public Map<String, Object> getProduct(
            @PathVariable int id) {

        return productService.getProductById(id);
    }

    // Add a new product

    @PostMapping
    public ResponseEntity<?> addProduct(
            @RequestBody Map<String, Object> request) {

        String name = request.get("name") instanceof String
                ? ((String) request.get("name")).trim()
                : "";

        String category = request.get("category") instanceof String
                ? ((String) request.get("category")).trim()
                : "";

        String description = request.get("description") instanceof String
                ? ((String) request.get("description")).trim()
                : "";

        Object priceValue = request.get("price");

        if (name.isBlank() || category.isBlank()) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                        "message",
                        "Product name and category are required"
                    ));
        }

        if (!(priceValue instanceof Number)
                || ((Number) priceValue).doubleValue() <= 0) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                        "message",
                        "Price must be a positive number"
                    ));
        }

        double price = ((Number) priceValue).doubleValue();

        Map<String, Object> savedProduct =
                productService.addProduct(
                    name,
                    category,
                    price,
                    description
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(savedProduct);
    }
}
