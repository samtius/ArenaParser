package com.samtius.arenaparser.parser;

import com.samtius.arenaparser.model.MatchResult;

public record DetectedArenaMatch(
        String arena,
        int instanceId,
        String matchType,
        String startTimestamp,
        String endTimestamp,
        int playerTeam,
        int winningTeam,
        int durationSeconds,
        MatchResult result
) {
}
