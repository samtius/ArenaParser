package com.samtius.arenaparser.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
public class LocalDatabaseMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    public LocalDatabaseMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        jdbcTemplate.execute("ALTER TABLE arena_matches DROP CONSTRAINT IF EXISTS arena_matches_result_check");
        jdbcTemplate.execute("ALTER TABLE arena_matches ADD CONSTRAINT arena_matches_result_check " +
                "CHECK (result IN ('WIN', 'LOSS', 'DRAW', 'UNKNOWN'))");
    }
}
