package com.circuitbreaker.gateway;

import java.time.Instant;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(
            Exception exception) {

        System.out.println(
                "Gateway Error: " + exception.getMessage()
        );

        Map<String, Object> error = Map.of(
                "timestamp", Instant.now().toString(),
                "status", 500,
                "error", "Internal Server Error",
                "message", "Gateway could not process the request"
        );

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(error);
    }
}
