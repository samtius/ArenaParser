package com.samtius.arenaparser.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@Profile("local")
@ConditionalOnProperty(
        name = "arenaparser.auto-import-enabled",
        havingValue = "true",
        matchIfMissing = true
)
public class AutomaticCombatLogImportService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AutomaticCombatLogImportService.class);

    private final CombatLogImportService combatLogImportService;
    private final ArenaMatchService arenaMatchService;
    private CombatLogImportService.CombatLogState lastProcessedState;

    public AutomaticCombatLogImportService(
            CombatLogImportService combatLogImportService,
            ArenaMatchService arenaMatchService
    ) {
        this.combatLogImportService = combatLogImportService;
        this.arenaMatchService = arenaMatchService;
    }

    @Scheduled(
            initialDelayString = "${arenaparser.auto-import-initial-delay-ms:2000}",
            fixedDelayString = "${arenaparser.auto-import-interval-ms:5000}"
    )
    public void importCompletedMatchesWhenLogChanges() {
        try {
            var currentState = combatLogImportService.currentCombatLogState();
            if (currentState.equals(lastProcessedState)) {
                return;
            }

            var detectedMatches = combatLogImportService.detectArenaMatches();
            var importedMatches = arenaMatchService.importDetectedMatches(detectedMatches);
            lastProcessedState = currentState;

            if (importedMatches > 0) {
                LOGGER.info("Automatically imported {} completed arena match(es)", importedMatches);
            }
        } catch (Exception exception) {
            LOGGER.debug("Automatic combat-log check could not be completed", exception);
        }
    }
}
