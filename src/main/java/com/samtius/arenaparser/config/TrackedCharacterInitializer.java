package com.samtius.arenaparser.config;

import com.samtius.arenaparser.dto.CreateTrackedCharacterRequest;
import com.samtius.arenaparser.service.TrackedCharacterService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class TrackedCharacterInitializer implements ApplicationRunner {
    private final TrackedCharacterService service;
    public TrackedCharacterInitializer(TrackedCharacterService service) { this.service = service; }

    @Override public void run(ApplicationArguments args) {
        if (!service.findAll().isEmpty()) return;
        service.create(new CreateTrackedCharacterRequest("Watur", "Defias Brotherhood", "eu"));
        service.create(new CreateTrackedCharacterRequest("Shadowfiend", "Defias Brotherhood", "eu"));
    }
}
