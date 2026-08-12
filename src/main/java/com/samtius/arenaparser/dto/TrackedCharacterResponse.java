package com.samtius.arenaparser.dto;

import tools.jackson.databind.JsonNode;
import java.time.Instant;

public record TrackedCharacterResponse(
        long id, String name, String realmSlug, String region, String characterClass,
        String activeSpecialization, Integer level, Integer itemLevel, Integer achievementPoints,
        String avatarUrl, Instant lastSyncedAt, String syncError, JsonNode equipment, JsonNode specializations
) { }
