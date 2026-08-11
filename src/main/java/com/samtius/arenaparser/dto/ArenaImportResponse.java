package com.samtius.arenaparser.dto;

public record ArenaImportResponse(
        int detectedMatches,
        int importedMatches,
        int skippedMatches
) {
}
