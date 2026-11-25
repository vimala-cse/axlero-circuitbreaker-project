package com.circuitbreaker.inventory;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class InventoryServiceTest {

    private ProductCatalogClient productCatalogClient;
    private InventoryService inventoryService;

    private List<Map<String, Object>> products;

    @BeforeEach
    void setUp() {

        productCatalogClient = mock(ProductCatalogClient.class);

        inventoryService =
                new InventoryService(productCatalogClient);

        products = List.of(
                Map.of("id", 1, "name", "Laptop"),
                Map.of("id", 2, "name", "Mobile"),
                Map.of("id", 3, "name", "Headphones"),
                Map.of("id", 4, "name", "Gaming Chair")
        );

        when(productCatalogClient.getProducts())
                .thenReturn(products);
    }

    @Test
    void returnsInventoryForKnownProduct() {

        Map<String, Object> inventory =
                inventoryService.getInventoryByProductId(1);

        assertEquals(20, inventory.get("stock"));
        assertEquals(true, inventory.get("available"));
    }

    @Test
    void returnsOutOfStockProduct() {

        Map<String, Object> inventory =
                inventoryService.getInventoryByProductId(2);

        assertEquals(0, inventory.get("stock"));
        assertEquals(false, inventory.get("available"));
    }

    @Test
    void automaticallyCreatesInventoryForNewProduct() {

        Map<String, Object> inventory =
                inventoryService.getInventoryByProductId(4);

        assertEquals("Gaming Chair", inventory.get("productName"));
        assertEquals(0, inventory.get("stock"));
        assertEquals(false, inventory.get("available"));
    }

    @Test
    void returnsAllProductsWithInventory() {

        List<Map<String, Object>> inventory =
                inventoryService.getAllInventory();

        assertFalse(inventory.isEmpty());

        assertTrue(inventory.stream().anyMatch(item ->
                "Gaming Chair".equals(item.get("productName"))
        ));
    }

    @Test
    void updatesStockQuantity() {

        Map<String, Object> inventory =
                inventoryService.updateStock(4, 25);

        assertEquals(25, inventory.get("stock"));
        assertEquals(true, inventory.get("available"));
    }

    @Test
    void rejectsNegativeStock() {

        assertThrows(
                ResponseStatusException.class,
                () -> inventoryService.updateStock(1, -5)
        );
    }

    @Test
    void throwsNotFoundForUnknownProduct() {

        assertThrows(
                ResponseStatusException.class,
                () -> inventoryService.getInventoryByProductId(
                        Integer.MAX_VALUE
                )
        );
    }
}
