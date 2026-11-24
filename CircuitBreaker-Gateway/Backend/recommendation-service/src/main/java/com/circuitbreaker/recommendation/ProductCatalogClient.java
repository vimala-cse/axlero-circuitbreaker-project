package com.circuitbreaker.recommendation;

import java.util.List;
import java.util.Map;

import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

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
            throw new RecommendationException(
                    "Product Service is not registered in Eureka");
        }

        ServiceInstance instance = instances.get(0);

        try {

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

            throw new RecommendationException(
                    "Unable to retrieve products from Product Service", e);
        }
    }
}

