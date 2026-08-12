package com.samtius.arenaparser.dto;

import com.samtius.arenaparser.model.MatchResult;
import java.time.Instant;
import java.util.List;

public record ArenaMatchSummary(
        Long id, String arena, Instant startedAt, int durationSeconds, Integer instanceId,
        String matchType, Integer playerTeam, Integer winningTeam, MatchResult result,
        Integer playerWins, Integer playerLosses, Integer playerMmr, Integer opponentMmr, List<CompositionMember> yourTeam,
        List<CompositionMember> opponentTeam
) {
    public record CompositionMember(String name, String className, String specializationName) { }
}
