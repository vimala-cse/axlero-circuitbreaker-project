package com.circuitbreaker.inventory;

import java.util.List;
import java.util.Map;

import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

@Component
public class ProductCatalogClient {

    private final DiscoveryClient discoveryClient;

    public ProductCatalogClient(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
    }

    public List<Map<String, Object>> getProducts() {

        List<ServiceInstance> instances =
                discoveryClient.getInstances("product-service");

        if (instances == null || instances.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Product Service is not registered in Eureka"
            );
        }

        try {

            ServiceInstance instance = instances.get(0);

            RestClient client = RestClient.builder()
                    .baseUrl(instance.getUri().toString())
                    .build();

            List<Map<String, Object>> products = client.get()
                    .uri("/api/products")
                    .retrieve()
                    .body(new ParameterizedTypeReference<
                            List<Map<String, Object>>>() {});

            return products == null ? List.of() : products;

        } catch (RestClientException e) {

            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Unable to retrieve products from Product Service",
                    e
            );
        }
    }
}
