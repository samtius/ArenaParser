package com.samtius.arenaparser.dto;

import java.util.Map;

public record DamageSummaryResponse(
        int eventCount,
        Map<String, Long> totalDamageBySource
) {
}
