package com.circuitbreaker.product;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

class ProductServiceTest {

    private final ProductService productService = new ProductService();

    @Test
    void returnsAllProducts() {

        List<Map<String, Object>> products =
                productService.getAllProducts();

        assertNotNull(products);
        assertFalse(products.isEmpty());
    }

    @Test
    void generatesUniqueProductIds() {

        List<Map<String, Object>> products =
                productService.getAllProducts();

        Set<Object> ids = new HashSet<>();

        for (Map<String, Object> product : products) {
            ids.add(product.get("id"));
        }

        assertEquals(products.size(), ids.size());
    }

    @Test
    void automaticallyAddsNewProductWithUniqueId() {

        Map<String, Object> addedProduct =
                productService.addProduct(
                        "Gaming Chair",
                        "Furniture",
                        8500,
                        "Comfortable gaming chair"
                );

        assertNotNull(addedProduct.get("id"));

        assertTrue(
                productService.getAllProducts().contains(addedProduct)
        );
    }

    @Test
    void returnsProductById() {

        assertEquals(
                "Laptop",
                productService.getProductById(1).get("name")
        );
    }

    @Test
    void throwsNotFoundForUnknownProduct() {

        assertThrows(
                ProductNotFoundException.class,
                () -> productService.getProductById(Integer.MAX_VALUE)
        );
    }
}
