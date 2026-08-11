package com.samtius.arenaparser.dto;

import com.samtius.arenaparser.model.MatchResult;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.Instant;

public record CreateArenaMatchRequest(
        @NotBlank String arena,
        @NotNull Instant startedAt,
        @PositiveOrZero int durationSeconds,
        @NotNull MatchResult result
) {
}
