package com.axlero.circuitbreaker.recommendation;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

// The remote control for chaos mode. The dashboard calls these through
// the gateway:
//   GET  /chaos                          -> what mode are we in right now?
//   POST /chaos?mode=normal              -> back to healthy
//   POST /chaos?mode=slow&delayMs=4000   -> every request waits 4 seconds
//   POST /chaos?mode=fail                -> every request returns HTTP 500
@RestController
@RequestMapping("/chaos")
public class ChaosController {

    private final ChaosState chaos;

    public ChaosController(ChaosState chaos) {
        this.chaos = chaos;
    }

    @GetMapping
    public Map<String, Object> current() {
        return describe();
    }

    @PostMapping
    public Map<String, Object> change(
            @RequestParam String mode,
            @RequestParam(defaultValue = "4000") long delayMs) {

        if (!mode.equals("normal") && !mode.equals("slow") && !mode.equals("fail")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "mode must be normal, slow or fail");
        }
        if (delayMs < 0 || delayMs > 30000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "delayMs must be between 0 and 30000");
        }

        chaos.set(mode, delayMs);
        return describe();
    }

    private Map<String, Object> describe() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("mode", chaos.getMode());
        body.put("delayMs", chaos.getDelayMs());
        return body;
    }
}
