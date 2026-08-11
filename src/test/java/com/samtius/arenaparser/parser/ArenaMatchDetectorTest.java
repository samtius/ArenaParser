package com.samtius.arenaparser.parser;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.nio.file.Files;

import static org.assertj.core.api.Assertions.assertThat;

class ArenaMatchDetectorTest {

    @TempDir
    Path tempDirectory;

    private final ArenaMatchDetector detector = new ArenaMatchDetector(new CombatLogParser());

    @Test
    void detectsCompletedArenaMatch() throws Exception {
        var matches = detector.detect(testLogPath());

        assertThat(matches).singleElement().satisfies(match -> {
            assertThat(match.arena()).isEqualTo("Nagrand Arena");
            assertThat(match.instanceId()).isEqualTo(1505);
            assertThat(match.matchType()).isEqualTo("Skirmish");
            assertThat(match.startTimestamp()).isEqualTo("8/11/2026 19:00:05.0000");
            assertThat(match.endTimestamp()).isEqualTo("8/11/2026 19:01:03.0000");
            assertThat(match.playerTeam()).isZero();
            assertThat(match.winningTeam()).isEqualTo(1);
            assertThat(match.durationSeconds()).isEqualTo(58);
            assertThat(match.result()).isEqualTo(com.samtius.arenaparser.model.MatchResult.LOSS);
        });
    }

    @Test
    void doesNotReturnMatchUntilArenaMatchEndExists() throws Exception {
        var incompleteLog = tempDirectory.resolve("WoWCombatLog.txt");
        Files.writeString(incompleteLog, """
                8/11/2026 19:00:00.0000  ZONE_CHANGE,1505,0,"Nagrand Arena",0
                8/11/2026 19:00:05.0000  ARENA_MATCH_START,1505,0,Skirmish,0
                8/11/2026 19:00:06.0000  SPELL_CAST_SUCCESS,Player-1,"Player",0x511,0x0,Player-2,"Enemy",0x548,0x0,116,"Frostbolt",0x10
                """);

        assertThat(detector.detect(incompleteLog)).isEmpty();
    }

    private Path testLogPath() throws URISyntaxException {
        var resource = getClass().getResource("/arena-combat-log-sample.txt");
        if (resource == null) {
            throw new IllegalStateException("Arena test combat log was not found");
        }
        return Path.of(resource.toURI());
    }
}
