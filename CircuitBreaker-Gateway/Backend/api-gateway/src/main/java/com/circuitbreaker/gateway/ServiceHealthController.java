package com.circuitbreaker.gateway;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.core.publisher.Mono;

@RestController
public class ServiceHealthController {

    private final WebClient webClient = WebClient.builder().build();

    private static final Map<String, String> SERVICE_URLS = Map.of(
        "gateway", "http://localhost:8080/actuator/health",
        "product", "http://localhost:8081/actuator/health",
        "inventory", "http://localhost:8082/actuator/health",
        "recommendation", "http://localhost:8083/actuator/health"
    );

    @GetMapping("/health/{service}")
    public Mono<Map<String, Object>> getServiceHealth(@PathVariable String service) {
        String url = SERVICE_URLS.get(service.toLowerCase());
        if (url == null) {
            return Mono.just(Map.of("service", service, "status", "UNKNOWN",
                "message", "Unknown service name"));
        }

        return webClient.get()
            .uri(url)
            .retrieve()
            .bodyToMono(Map.class)
            .map(body -> Map.<String, Object>of(
                "service", service,
                "status", String.valueOf(body.getOrDefault("status", "UNKNOWN")),
                "details", body))
            .onErrorResume(error -> Mono.just(Map.<String, Object>of(
                "service", service,
                "status", "DOWN",
                "message", error.getMessage() == null ? "Health endpoint unavailable" : error.getMessage())))
            .defaultIfEmpty(Map.of("service", service, "status", "UNKNOWN"));
    }
}
