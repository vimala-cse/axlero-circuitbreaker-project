package com.circuitbreaker.inventory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class InventoryServiceTest {

    private final InventoryService inventoryService = new InventoryService();

    @Test
    void returnsInventoryForKnownProduct() {
        assertEquals(20, inventoryService.getInventoryByProductId(1).get("stock"));
    }

    @Test
    void returnsOutOfStockProduct() {
        assertEquals(false, inventoryService.getInventoryByProductId(2).get("available"));
    }

    @Test
    void throwsNotFoundForUnknownProduct() {
        assertThrows(ResponseStatusException.class, () -> inventoryService.getInventoryByProductId(999));
    }
}
