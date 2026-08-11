package com.samtius.arenaparser.service;

import com.samtius.arenaparser.dto.CreateArenaMatchRequest;
import com.samtius.arenaparser.model.MatchResult;
import com.samtius.arenaparser.repository.ArenaMatchRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

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
}
