package com.samtius.arenaparser.parser;

import org.junit.jupiter.api.Test;

import java.net.URISyntaxException;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class CombatLogParserTest {

    private final CombatLogParser parser = new CombatLogParser();

    @Test
    void parsesSpellDamageEventsFromCombatLog() throws Exception {
        var events = parser.parseDamageEvents(testLogPath());

        assertThat(events).hasSize(3);
        assertThat(events.getFirst()).satisfies(event -> {
            assertThat(event.timestamp()).isEqualTo("8/11 18:30:01.123");
            assertThat(event.sourceName()).isEqualTo("Test Warrior");
            assertThat(event.targetName()).isEqualTo("Test Mage");
            assertThat(event.spellId()).isEqualTo(12345);
            assertThat(event.spellName()).isEqualTo("Mortal Strike");
            assertThat(event.amount()).isEqualTo(1200);
        });
    }

    @Test
    void calculatesTotalDamageBySource() throws Exception {
        var events = parser.parseDamageEvents(testLogPath());

        var totals = parser.totalDamageBySource(events);

        assertThat(totals)
                .containsEntry("Test Warrior", 3500L)
                .containsEntry("Test Mage", 900L);
    }

    @Test
    void ignoresUnsupportedAndMalformedLines() {
        assertThat(parser.parseDamageEvent("not a combat log line")).isEmpty();
        assertThat(parser.parseDamageEvent(
                "8/11 18:30:01.123  SPELL_HEAL,Player-1,\"Test Warrior\""
        )).isEmpty();
    }

    @Test
    void parsesRetailAdvancedCombatLogFormat() {
        var line = "8/11/2026 13:08:31.2982  SPELL_DAMAGE,Player-1096-081BDFEB,"
                + "\"Althanae-Sporeggar-EU\",0x548,0x80000000,Creature-0-4236-0-23354-243207-00007ADD5C,"
                + "\"Training Dummy\",0xa28,0x80000000,443763,\"Arcane Splinter\",0x40,"
                + "Creature-0-4236-0-23354-243207-00007ADD5C,0000000000000000,69071,3537050,0,0,1470,"
                + "0,0,0,1,0,0,0,8206.98,-4362.82,2393,2.4666,90,4361,1796,-1,64,0,0,0,1,nil,nil,ST";

        var event = parser.parseDamageEvent(line);

        assertThat(event).hasValueSatisfying(damage -> {
            assertThat(damage.timestamp()).isEqualTo("8/11/2026 13:08:31.2982");
            assertThat(damage.sourceName()).isEqualTo("Althanae-Sporeggar-EU");
            assertThat(damage.targetName()).isEqualTo("Training Dummy");
            assertThat(damage.spellName()).isEqualTo("Arcane Splinter");
            assertThat(damage.amount()).isEqualTo(4361);
        });
    }

    private Path testLogPath() throws URISyntaxException {
        var resource = getClass().getResource("/combat-log-sample.txt");
        if (resource == null) {
            throw new IllegalStateException("Test combat log was not found");
        }
        return Path.of(resource.toURI());
    }
}
