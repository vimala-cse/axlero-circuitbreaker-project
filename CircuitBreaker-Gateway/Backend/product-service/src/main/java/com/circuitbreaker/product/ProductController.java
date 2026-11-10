package com.circuitbreaker.product;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public List<Map<String, Object>> getProducts() {

        return productService.getAllProducts();
    }

    @GetMapping("/{id}")
    public Map<String, Object> getProduct(
            @PathVariable int id) {

        return productService.getProductById(id);
    }
}