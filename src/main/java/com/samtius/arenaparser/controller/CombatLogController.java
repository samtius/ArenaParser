package com.samtius.arenaparser.controller;

import com.samtius.arenaparser.dto.DamageSummaryResponse;
import com.samtius.arenaparser.dto.ArenaImportResponse;
import com.samtius.arenaparser.service.ArenaMatchService;
import com.samtius.arenaparser.parser.DetectedArenaMatch;
import com.samtius.arenaparser.service.CombatLogImportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;

@RestController
@RequestMapping("/api/combat-log")
public class CombatLogController {

    private final CombatLogImportService combatLogImportService;
    private final ArenaMatchService arenaMatchService;

    public CombatLogController(
            CombatLogImportService combatLogImportService,
            ArenaMatchService arenaMatchService
    ) {
        this.combatLogImportService = combatLogImportService;
        this.arenaMatchService = arenaMatchService;
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

    @GetMapping("/arena-matches")
    public List<DetectedArenaMatch> arenaMatches() {
        try {
            return combatLogImportService.detectArenaMatches();
        } catch (IOException | IllegalStateException exception) {
            throw new ResponseStatusException(
                    INTERNAL_SERVER_ERROR,
                    "Could not detect arena matches in the configured combat log",
                    exception
            );
        }
    }

    @PostMapping("/import-arena-matches")
    public ArenaImportResponse importArenaMatches() {
        try {
            var detectedMatches = combatLogImportService.detectArenaMatches();
            var importedMatches = arenaMatchService.importDetectedMatches(detectedMatches);
            return new ArenaImportResponse(
                    detectedMatches.size(),
                    importedMatches,
                    detectedMatches.size() - importedMatches
            );
        } catch (IOException | IllegalStateException exception) {
            throw new ResponseStatusException(
                    INTERNAL_SERVER_ERROR,
                    "Could not import arena matches from the configured combat log",
                    exception
            );
        }
    }

    @PostMapping("/reimport-all-arena-matches")
    public ArenaImportResponse reimportAllArenaMatches() {
        try {
            var detectedMatches = combatLogImportService.detectArenaMatchesFromAllLogs();
            var importedMatches = arenaMatchService.importDetectedMatches(detectedMatches);
            return new ArenaImportResponse(detectedMatches.size(), importedMatches, detectedMatches.size() - importedMatches);
        } catch (IOException | IllegalStateException exception) {
            throw new ResponseStatusException(
                    INTERNAL_SERVER_ERROR,
                    "Could not reimport arena matches from all configured combat logs",
                    exception
            );
        }
    }
}
