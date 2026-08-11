package com.samtius.arenaparser.service;

import com.samtius.arenaparser.dto.CreateArenaMatchRequest;
import com.samtius.arenaparser.model.ArenaMatch;
import com.samtius.arenaparser.parser.DetectedArenaMatch;
import com.samtius.arenaparser.repository.ArenaMatchRepository;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoField;
import java.util.List;
import java.util.Optional;

@Service
public class ArenaMatchService {

    private final ArenaMatchRepository arenaMatchRepository;
    private final ZoneId combatLogZone;
    private static final DateTimeFormatter COMBAT_LOG_TIMESTAMP = new DateTimeFormatterBuilder()
            .appendPattern("M/d/yyyy HH:mm:ss")
            .appendFraction(ChronoField.NANO_OF_SECOND, 1, 9, true)
            .toFormatter();

    public ArenaMatchService(
            ArenaMatchRepository arenaMatchRepository,
            @Value("${arenaparser.combat-log-zone:Europe/Stockholm}") String combatLogZone
    ) {
        this.arenaMatchRepository = arenaMatchRepository;
        this.combatLogZone = ZoneId.of(combatLogZone);
    }

    public List<ArenaMatch> findAll() {
        return arenaMatchRepository.findAll();
    }

    public Optional<ArenaMatch> findById(long id) {
        return arenaMatchRepository.findById(id);
    }

    public ArenaMatch create(CreateArenaMatchRequest request) {
        var match = new ArenaMatch();
        match.setArena(request.arena());
        match.setStartedAt(request.startedAt());
        match.setDurationSeconds(request.durationSeconds());
        match.setResult(request.result());

        return arenaMatchRepository.save(match);
    }

    @Transactional
    public int importDetectedMatches(List<DetectedArenaMatch> detectedMatches) {
        var importedMatches = 0;

        for (var detected : detectedMatches) {
            var sourceKey = detected.instanceId() + ":" + detected.startTimestamp();
            if (arenaMatchRepository.existsBySourceKey(sourceKey)) {
                continue;
            }

            var match = new ArenaMatch();
            match.setArena(detected.arena());
            match.setInstanceId(detected.instanceId());
            match.setMatchType(detected.matchType());
            match.setStartedAt(parseTimestamp(detected.startTimestamp()));
            match.setDurationSeconds(detected.durationSeconds());
            match.setPlayerTeam(detected.playerTeam());
            match.setWinningTeam(detected.winningTeam());
            match.setResult(detected.result());
            match.setSourceKey(sourceKey);
            arenaMatchRepository.save(match);
            importedMatches++;
        }

        return importedMatches;
    }

    private java.time.Instant parseTimestamp(String timestamp) {
        return LocalDateTime.parse(timestamp, COMBAT_LOG_TIMESTAMP)
                .atZone(combatLogZone)
                .toInstant();
    }
}
