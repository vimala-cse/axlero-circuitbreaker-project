package com.circuitbreaker.product;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class ProductServiceTest {

    private final ProductService productService = new ProductService();

    @Test
    void returnsAllProducts() {
        assertEquals(3, productService.getAllProducts().size());
    }

    @Test
    void returnsProductById() {
        assertEquals("Laptop", productService.getProductById(1).get("name"));
    }

    @Test
    void throwsNotFoundForUnknownProduct() {
        assertThrows(ProductNotFoundException.class, () -> productService.getProductById(999));
    }
}
