package com.circuitbreaker.recommendation;

public class RecommendationException extends RuntimeException {

    public RecommendationException(String message) {
        super(message);
    }

    public RecommendationException(
            String message,
            Throwable cause) {

        super(message, cause);
    }
}
