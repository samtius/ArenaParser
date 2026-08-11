package com.samtius.arenaparser.controller;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HealthControllerTest {

    @Test
    void returnsApplicationHealth() {
        var response = new HealthController().health();

        assertThat(response.status()).isEqualTo("ok");
        assertThat(response.application()).isEqualTo("ArenaParser");
    }
}
