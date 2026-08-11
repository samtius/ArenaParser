package com.samtius.arenaparser.controller;

import com.samtius.arenaparser.dto.DamageSummaryResponse;
import com.samtius.arenaparser.service.CombatLogImportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;

import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;

@RestController
@RequestMapping("/api/combat-log")
public class CombatLogController {

    private final CombatLogImportService combatLogImportService;

    public CombatLogController(CombatLogImportService combatLogImportService) {
        this.combatLogImportService = combatLogImportService;
    }

    @GetMapping("/damage-summary")
    public DamageSummaryResponse damageSummary() {
        try {
            return combatLogImportService.readDamageSummary();
        } catch (IOException | IllegalStateException exception) {
            throw new ResponseStatusException(
                    INTERNAL_SERVER_ERROR,
                    "Could not read the configured combat log",
                    exception
            );
        }
    }
}
