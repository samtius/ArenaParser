package com.samtius.arenaparser.service;

import com.samtius.arenaparser.parser.CombatLogParser;
import com.samtius.arenaparser.parser.ArenaMatchDetector;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.nio.file.Files;

import static org.assertj.core.api.Assertions.assertThat;

class CombatLogImportServiceTest {

    @TempDir
    Path tempDirectory;

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
                .containsEntry("Test Warrior", 3500L)
                .containsEntry("Test Mage", 900L);
    }

    @Test
    void detectsMatchesFromEveryCombatLogInDirectory() throws Exception {
        Files.writeString(tempDirectory.resolve("WoWCombatLog-1.txt"), arenaLog("19:00:05", "19:01:03"));
        Files.writeString(tempDirectory.resolve("WoWCombatLog-2.txt"), arenaLog("20:00:05", "20:01:03"));
        Files.writeString(tempDirectory.resolve("unrelated.txt"), arenaLog("21:00:05", "21:01:03"));
        var service = new CombatLogImportService(new CombatLogParser(), new ArenaMatchDetector(new CombatLogParser()), tempDirectory.toString());

        assertThat(service.detectArenaMatchesFromAllLogs()).hasSize(2);
    }

    private String arenaLog(String start, String end) {
        return """
                8/11/2026 19:00:00.0000  ZONE_CHANGE,1505,0,"Nagrand Arena",0
                8/11/2026 %s.0000  ARENA_MATCH_START,1505,0,2v2,0
                8/11/2026 %s.0000  ARENA_MATCH_END,0,58
                """.formatted(start, end);
    }

    private Path testLogPath() throws URISyntaxException {
        var resource = getClass().getResource("/combat-log-sample.txt");
        if (resource == null) {
            throw new IllegalStateException("Test combat log was not found");
        }
        return Path.of(resource.toURI());
    }
}
