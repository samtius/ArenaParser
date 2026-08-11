package com.samtius.arenaparser.service;

import com.samtius.arenaparser.dto.CreateArenaMatchRequest;
import com.samtius.arenaparser.model.MatchResult;
import com.samtius.arenaparser.repository.ArenaMatchRepository;
import com.samtius.arenaparser.parser.DetectedArenaMatch;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class ArenaMatchServiceTest {

    @Autowired
    private ArenaMatchService service;

    @Autowired
    private ArenaMatchRepository repository;

    @Test
    void createsAndFindsArenaMatch() {
        var request = new CreateArenaMatchRequest(
                "Nagrand Arena",
                Instant.parse("2026-08-11T18:30:00Z"),
                163,
                MatchResult.WIN
        );

        var createdMatch = service.create(request);

        assertThat(createdMatch.getId()).isNotNull();
        assertThat(service.findById(createdMatch.getId())).contains(createdMatch);
        assertThat(service.findAll()).containsExactly(createdMatch);
        assertThat(repository.findById(createdMatch.getId())).contains(createdMatch);
    }

    @Test
    void returnsEmptyWhenMatchDoesNotExist() {
        assertThat(service.findById(99L)).isEmpty();
    }

    @Test
    void importsArenaMatchOnlyOnce() {
        var detected = new DetectedArenaMatch(
                "Nagrand Arena",
                1505,
                "Skirmish",
                "8/11/2026 13:46:32.0102",
                "8/11/2026 13:48:21.3452",
                0,
                1,
                109,
                MatchResult.LOSS,
                com.samtius.arenaparser.dto.MatchCombatDetails.empty(),
                null,
                null
        );

        assertThat(service.importDetectedMatches(List.of(detected))).isEqualTo(1);
        assertThat(service.importDetectedMatches(List.of(detected))).isZero();

        var savedMatch = service.findAll().getFirst();
        assertThat(savedMatch.getArena()).isEqualTo("Nagrand Arena");
        assertThat(savedMatch.getResult()).isEqualTo(MatchResult.LOSS);
        assertThat(savedMatch.getPlayerTeam()).isZero();
        assertThat(savedMatch.getWinningTeam()).isEqualTo(1);
        assertThat(savedMatch.getDurationSeconds()).isEqualTo(109);
    }
}
