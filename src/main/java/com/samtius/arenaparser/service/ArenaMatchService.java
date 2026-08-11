package com.samtius.arenaparser.service;

import com.samtius.arenaparser.dto.CreateArenaMatchRequest;
import com.samtius.arenaparser.model.ArenaMatch;
import com.samtius.arenaparser.parser.DetectedArenaMatch;
import com.samtius.arenaparser.repository.ArenaMatchRepository;
import com.samtius.arenaparser.dto.MatchCombatDetails;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
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
    private final ObjectMapper objectMapper;
    private static final DateTimeFormatter COMBAT_LOG_TIMESTAMP = new DateTimeFormatterBuilder()
            .appendPattern("M/d/yyyy HH:mm:ss")
            .appendFraction(ChronoField.NANO_OF_SECOND, 1, 9, true)
            .toFormatter();

    public ArenaMatchService(
            ArenaMatchRepository arenaMatchRepository,
            ObjectMapper objectMapper,
            @Value("${arenaparser.combat-log-zone:Europe/Stockholm}") String combatLogZone
    ) {
        this.arenaMatchRepository = arenaMatchRepository;
        this.objectMapper = objectMapper;
        this.combatLogZone = ZoneId.of(combatLogZone);
    }

    public List<ArenaMatch> findAll() {
        return arenaMatchRepository.findAll();
    }

    public Optional<ArenaMatch> findById(long id) {
        return arenaMatchRepository.findById(id);
    }

    public Optional<MatchCombatDetails> findCombatDetails(long id) {
        return arenaMatchRepository.findById(id).map(match -> {
            if (match.getCombatDetailsJson() == null || match.getCombatDetailsJson().isBlank()) {
                return MatchCombatDetails.empty();
            }
            try {
                return objectMapper.readValue(match.getCombatDetailsJson(), MatchCombatDetails.class);
            } catch (JacksonException exception) {
                throw new IllegalStateException("Could not read stored combat details", exception);
            }
        });
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
            var existingMatch = arenaMatchRepository.findBySourceKey(sourceKey);
            if (existingMatch.isPresent()) {
                var match = existingMatch.get();
                match.setMatchType(detected.matchType());
                match.setDurationSeconds(detected.durationSeconds());
                match.setPlayerTeam(detected.playerTeam());
                match.setWinningTeam(detected.winningTeam());
                match.setPlayerWins(detected.playerWins());
                match.setPlayerLosses(detected.playerLosses());
                match.setResult(detected.result());
                match.setCombatDetailsJson(writeDetails(detected.combatDetails()));
                arenaMatchRepository.save(match);
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
            match.setPlayerWins(detected.playerWins());
            match.setPlayerLosses(detected.playerLosses());
            match.setResult(detected.result());
            match.setSourceKey(sourceKey);
            match.setCombatDetailsJson(writeDetails(detected.combatDetails()));
            arenaMatchRepository.save(match);
            importedMatches++;
        }

        return importedMatches;
    }

    private String writeDetails(MatchCombatDetails details) {
        try {
            return objectMapper.writeValueAsString(details == null ? MatchCombatDetails.empty() : details);
        } catch (JacksonException exception) {
            throw new IllegalStateException("Could not store combat details", exception);
        }
    }

    private java.time.Instant parseTimestamp(String timestamp) {
        return LocalDateTime.parse(timestamp, COMBAT_LOG_TIMESTAMP)
                .atZone(combatLogZone)
                .toInstant();
    }
}
