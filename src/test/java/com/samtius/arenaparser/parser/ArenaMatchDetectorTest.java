package com.samtius.arenaparser.parser;

import org.junit.jupiter.api.Test;

import java.net.URISyntaxException;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class ArenaMatchDetectorTest {

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

    private Path testLogPath() throws URISyntaxException {
        var resource = getClass().getResource("/arena-combat-log-sample.txt");
        if (resource == null) {
            throw new IllegalStateException("Arena test combat log was not found");
        }
        return Path.of(resource.toURI());
    }
}
