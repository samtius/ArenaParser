package com.samtius.arenaparser.parser;

import java.util.List;

public record CombatLogLine(
        String timestamp,
        String eventType,
        List<String> fields
) {
}
