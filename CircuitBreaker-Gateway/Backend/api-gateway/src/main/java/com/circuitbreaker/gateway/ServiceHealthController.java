package com.circuitbreaker.gateway;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
public class ServiceHealthController {

    private final DiscoveryClient discoveryClient;
    private final WebClient webClient;

    private static final Map<String, String> SERVICE_IDS = Map.of(
        "product", "product-service",
        "inventory", "inventory-service",
        "recommendation", "recommendation-service"
    );

    public ServiceHealthController(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
        this.webClient = WebClient.builder().build();
    }

    @GetMapping("/health/{service}")
    public Mono<Map<String, Object>> getServiceHealth(
            @PathVariable String service) {

        String serviceKey = service.toLowerCase(Locale.ROOT);

        // Gateway is responding because this endpoint is running.
        if ("gateway".equals(serviceKey)) {
            return Mono.just(Map.of(
                "service", "gateway",
                "status", "UP",
                "instanceCount", 1,
                "healthyInstances", 1,
                "message", "API Gateway is responding"
            ));
        }

        String serviceId = SERVICE_IDS.get(serviceKey);

        if (serviceId == null) {
            return Mono.just(Map.of(
                "service", service,
                "status", "UNKNOWN",
                "message", "Unknown service name"
            ));
        }

        List<ServiceInstance> instances;

        try {
            instances = discoveryClient.getInstances(serviceId);
        } catch (Exception exception) {
            return Mono.just(Map.of(
                "service", serviceKey,
                "status", "UNKNOWN",
                "message", "Unable to contact Eureka service registry"
            ));
        }

        if (instances == null || instances.isEmpty()) {
            return Mono.just(Map.of(
                "service", serviceKey,
                "status", "NOT_REGISTERED",
                "instanceCount", 0,
                "healthyInstances", 0,
                "instances", List.of(),
                "message", "No instances registered in Eureka"
            ));
        }

        return Flux.fromIterable(instances)
            .flatMap(this::checkInstance)
            .collectList()
            .map(this::buildServiceHealthResponse)
            .map(result -> {
                result.put("service", serviceKey);
                return result;
            });
    }

    private Mono<Map<String, Object>> checkInstance(
            ServiceInstance instance) {

        return webClient.get()
            .uri(instance.getUri().resolve("/actuator/health"))
            .retrieve()
            .bodyToMono(
                new ParameterizedTypeReference<Map<String, Object>>() {}
            )
            .map(body -> {
                String status = String.valueOf(
                    body.getOrDefault("status", "UNKNOWN")
                ).toUpperCase(Locale.ROOT);

                return createInstanceResult(instance, status, body);
            })
            .defaultIfEmpty(createInstanceResult(
                instance,
                "UNKNOWN",
                Map.of("message", "Empty health response")
            ))
            .onErrorResume(error -> Mono.just(
                createInstanceResult(
                    instance,
                    "DOWN",
                    Map.of("message", "Health endpoint unavailable")
                )
            ));
    }

    private Map<String, Object> createInstanceResult(
            ServiceInstance instance,
            String status,
            Map<String, Object> details) {

        Map<String, Object> result = new LinkedHashMap<>();

        String instanceId = instance.getInstanceId();

        result.put(
            "instanceId",
            instanceId != null
                ? instanceId
                : instance.getHost() + ":" + instance.getPort()
        );

        result.put("host", instance.getHost());
        result.put("port", instance.getPort());
        result.put("status", status);
        result.put("details", details);

        return result;
    }

    private Map<String, Object> buildServiceHealthResponse(
            List<Map<String, Object>> instanceResults) {

        long healthyInstances = instanceResults.stream()
            .filter(instance -> "UP".equals(instance.get("status")))
            .count();

        String overallStatus;

        if (healthyInstances == instanceResults.size()) {
            overallStatus = "UP";
        } else if (healthyInstances > 0) {
            overallStatus = "DEGRADED";
        } else {
            overallStatus = "DOWN";
        }

        Map<String, Object> response = new LinkedHashMap<>();

        response.put("status", overallStatus);
        response.put("instanceCount", instanceResults.size());
        response.put("healthyInstances", healthyInstances);
        response.put("instances", instanceResults);

        return response;
    }
}
