package com.samtius.arenaparser.parser;

import com.samtius.arenaparser.dto.MatchCombatDetails;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.nio.file.Files;

import static org.assertj.core.api.Assertions.assertThat;

class ArenaMatchDetectorTest {

    @TempDir
    Path tempDirectory;

    private final ArenaMatchDetector detector = new ArenaMatchDetector(new CombatLogParser());

    @Test
    void detectsCompletedArenaMatch() throws Exception {
        var matches = detector.detect(testLogPath());

        assertThat(matches).singleElement().satisfies(match -> {
            assertThat(match.arena()).isEqualTo("Nagrand Arena");
            assertThat(match.instanceId()).isEqualTo(1505);
            assertThat(match.matchType()).isEqualTo("Skirmish");
            assertThat(match.startTimestamp()).isEqualTo("8/11/2026 19:00:05.0000");
            assertThat(match.endTimestamp()).isEqualTo("8/11/2026 19:01:03.0000");
            assertThat(match.playerTeam()).isZero();
            assertThat(match.winningTeam()).isEqualTo(1);
            assertThat(match.durationSeconds()).isEqualTo(58);
            assertThat(match.result()).isEqualTo(com.samtius.arenaparser.model.MatchResult.LOSS);
        });
    }

    @Test
    void doesNotReturnMatchUntilArenaMatchEndExists() throws Exception {
        var incompleteLog = tempDirectory.resolve("WoWCombatLog.txt");
        Files.writeString(incompleteLog, """
                8/11/2026 19:00:00.0000  ZONE_CHANGE,1505,0,"Nagrand Arena",0
                8/11/2026 19:00:05.0000  ARENA_MATCH_START,1505,0,Skirmish,0
                8/11/2026 19:00:06.0000  SPELL_CAST_SUCCESS,Player-1,"Player",0x511,0x0,Player-2,"Enemy",0x548,0x0,116,"Frostbolt",0x10
                """);

        assertThat(detector.detect(incompleteLog)).isEmpty();
    }

    @Test
    void attributesSummonedPetDamageAndHealingToItsOwner() throws Exception {
        var log = tempDirectory.resolve("pet-combat-log.txt");
        Files.writeString(log, """
                8/11/2026 19:00:00.0000  ZONE_CHANGE,1505,0,"Nagrand Arena",0
                8/11/2026 19:00:05.0000  ARENA_MATCH_START,1505,0,Skirmish,0
                8/11/2026 19:00:06.0000  SPELL_SUMMON,Player-1,"Owner",0x511,0x0,Creature-1,"Mindbender",0xa28,0x0,123040,"Mindbender",0x20
                8/11/2026 19:00:07.0000  SPELL_DAMAGE,Creature-1,"Mindbender",0x2111,0x0,Player-2,"Enemy",0x548,0x0,123121,"Mind Blast",0x20,1500,0
                8/11/2026 19:00:08.0000  SPELL_HEAL,Creature-1,"Mindbender",0x2111,0x0,Player-1,"Owner",0x511,0x0,123122,"Pet Heal",0x20,800,200
                8/11/2026 19:00:09.0000  SPELL_MISSED,Creature-1,"Mindbender",0x2111,0x0,Player-2,"Enemy",0x548,0x0,123121,"Mind Blast",0x20,ABSORB,nil,300,400,1
                8/11/2026 19:00:10.0000  SWING_MISSED,Creature-1,"Mindbender",0x2111,0x0,Player-2,"Enemy",0x548,0x0,ABSORB,nil,200,250,nil
                8/11/2026 19:00:11.0000  SPELL_MISSED,Creature-1,"Mindbender",0x2111,0x0,Player-2,"Enemy",0x548,0x0,123121,"Mind Blast",0x20,DODGE,nil,999,999,nil
                8/11/2026 19:01:03.0000  ARENA_MATCH_END,1,58
                """);

        var owner = detector.detect(log).getFirst().combatDetails().participants().stream()
                .filter(participant -> participant.name().equals("Owner"))
                .findFirst().orElseThrow();

        assertThat(owner.damage()).isEqualTo(2000);
        assertThat(owner.healing()).isEqualTo(600);
        assertThat(owner.spells()).extracting(MatchCombatDetails.SpellStatistic::name)
                .contains("Mindbender: Mind Blast", "Mindbender: Pet Heal");
    }

    private Path testLogPath() throws URISyntaxException {
        var resource = getClass().getResource("/arena-combat-log-sample.txt");
        if (resource == null) {
            throw new IllegalStateException("Arena test combat log was not found");
        }
        return Path.of(resource.toURI());
    }
}
