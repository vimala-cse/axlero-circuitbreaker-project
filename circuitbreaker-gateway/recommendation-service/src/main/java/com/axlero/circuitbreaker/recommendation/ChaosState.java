package com.axlero.circuitbreaker.recommendation;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

// Remembers whether this service is currently behaving normally or
// misbehaving ON PURPOSE. We need this because the whole project is
// about proving the gateway's circuit breaker protects the site when a
// service gets into trouble - so we need a way to put this service into
// trouble whenever we want, then fix it again, without restarting it.
//
// Modes:
//   normal - answers immediately (default)
//   slow   - waits delayMs before answering (simulates an overloaded service)
//   fail   - answers with HTTP 500 (simulates a crashing service)
@Component
public class ChaosState {

    // volatile: the chaos endpoint changes these on one thread while
    // request-handling threads read them on others.
    private volatile String mode = "normal";
    private volatile long delayMs = 4000;

    public String getMode() {
        return mode;
    }

    public long getDelayMs() {
        return delayMs;
    }

    public void set(String mode, long delayMs) {
        this.mode = mode;
        this.delayMs = delayMs;
    }

    // Called at the start of every recommendation request. Does nothing
    // in normal mode; otherwise it makes the request slow or failing.
    public void applyChaos() throws InterruptedException {
        if ("slow".equals(mode)) {
            Thread.sleep(delayMs);
        } else if ("fail".equals(mode)) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "Chaos mode: simulated failure");
        }
    }
}
