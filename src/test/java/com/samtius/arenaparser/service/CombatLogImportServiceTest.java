package com.samtius.arenaparser.service;

import com.samtius.arenaparser.parser.CombatLogParser;
import com.samtius.arenaparser.parser.ArenaMatchDetector;
import org.junit.jupiter.api.Test;

import java.net.URISyntaxException;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class CombatLogImportServiceTest {

    @Test
    void readsConfiguredCombatLogAndCreatesSummary() throws Exception {
        var service = new CombatLogImportService(
                new CombatLogParser(),
                new ArenaMatchDetector(new CombatLogParser()),
                testLogPath().toString()
        );

        var summary = service.readDamageSummary();

        assertThat(summary.eventCount()).isEqualTo(3);
        assertThat(summary.totalDamageBySource())
                .containsEntry("Samtius", 3500L)
                .containsEntry("Enemy Mage", 900L);
    }

    private Path testLogPath() throws URISyntaxException {
        var resource = getClass().getResource("/combat-log-sample.txt");
        if (resource == null) {
            throw new IllegalStateException("Test combat log was not found");
        }
        return Path.of(resource.toURI());
    }
}
