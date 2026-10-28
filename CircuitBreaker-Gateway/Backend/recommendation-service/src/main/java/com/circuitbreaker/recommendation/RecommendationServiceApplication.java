package com.circuitbreaker.recommendation;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class RecommendationServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(
            RecommendationServiceApplication.class, args);

        System.out.println(
            "Recommendation Service started on port 8083");
    }
}
