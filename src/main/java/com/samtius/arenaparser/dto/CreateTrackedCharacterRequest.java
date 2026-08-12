package com.samtius.arenaparser.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreateTrackedCharacterRequest(
        @NotBlank String name,
        @NotBlank String realm,
        @Pattern(regexp = "(?i)^(eu|us|kr|tw)$", message = "region must be EU, US, KR or TW") String region
) { }
