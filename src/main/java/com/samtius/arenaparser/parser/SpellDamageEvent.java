package com.samtius.arenaparser.parser;

public record SpellDamageEvent(
        String timestamp,
        String sourceGuid,
        String sourceName,
        String targetGuid,
        String targetName,
        int spellId,
        String spellName,
        long amount
) {
}
