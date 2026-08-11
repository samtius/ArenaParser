package com.samtius.arenaparser.parser;

import com.samtius.arenaparser.model.MatchResult;
import com.samtius.arenaparser.dto.MatchCombatDetails;

public record DetectedArenaMatch(
        String arena,
        int instanceId,
        String matchType,
        String startTimestamp,
        String endTimestamp,
        int playerTeam,
        int winningTeam,
        int durationSeconds,
        MatchResult result,
        MatchCombatDetails combatDetails,
        Integer playerWins,
        Integer playerLosses
) {
}
