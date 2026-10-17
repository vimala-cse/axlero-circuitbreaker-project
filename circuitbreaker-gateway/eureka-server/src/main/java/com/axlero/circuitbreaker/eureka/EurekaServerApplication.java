package com.axlero.circuitbreaker.eureka;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

// This is the "phone book" of the whole system. Every microservice
// (product, inventory, recommendation) and the API Gateway register
// themselves here on startup, with their name and current host:port.
// Nobody hard-codes "localhost:8081" anywhere else in the project -
// they just ask Eureka "where is product-service right now?" This is
// what lets the Gateway keep routing correctly even if a service
// restarts on a different port, or we scale a service to multiple
// instances later.
@SpringBootApplication
@EnableEurekaServer
public class EurekaServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(EurekaServerApplication.class, args);
    }
}
