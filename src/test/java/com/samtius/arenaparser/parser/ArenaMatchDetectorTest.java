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

    @Test
    void addsRealDeathsToTimelineButDoesNotTreatFeignDeathAsDeath() throws Exception {
        var log = tempDirectory.resolve("death-timeline-log.txt");
        Files.writeString(log, """
                8/11/2026 19:00:00.0000  ZONE_CHANGE,1505,0,"Nagrand Arena",0
                8/11/2026 19:00:05.0000  ARENA_MATCH_START,1505,0,Skirmish,0
                8/11/2026 19:00:10.0000  UNIT_DIED,0000000000000000,nil,0x80000000,0x80000000,Player-2,"Hunter",0x548,0x0
                8/11/2026 19:00:10.2000  SPELL_AURA_APPLIED,Player-2,"Hunter",0x548,0x0,Player-2,"Hunter",0x548,0x0,5384,"Feign Death",0x1,BUFF
                8/11/2026 19:00:20.0000  SPELL_DAMAGE,Player-1,"Player",0x511,0x0,Player-2,"Hunter",0x548,0x0,116,"Frostbolt",0x10,1000,0
                8/11/2026 19:00:21.0000  UNIT_DIED,0000000000000000,nil,0x80000000,0x80000000,Player-2,"Hunter",0x548,0x0
                8/11/2026 19:00:23.0000  SPELL_CAST_SUCCESS,Player-1,"Player",0x511,0x0,Player-2,"Hunter",0x548,0x0,116,"Frostbolt",0x10
                8/11/2026 19:00:24.0000  SPELL_AURA_APPLIED,Player-1,"Player",0x511,0x0,Player-2,"Hunter",0x548,0x0,8122,"Psychic Scream",0x20,DEBUFF
                8/11/2026 19:00:27.2500  SPELL_AURA_REMOVED,Player-1,"Player",0x511,0x0,Player-2,"Hunter",0x548,0x0,8122,"Psychic Scream",0x20,DEBUFF
                8/11/2026 19:00:28.0000  SPELL_AURA_APPLIED,Player-1,"Player",0x511,0x0,Player-2,"Hunter",0x548,0x0,33206,"Pain Suppression",0x2,BUFF
                8/11/2026 19:00:29.0000  SPELL_MISSED,Player-1,"Player",0x511,0x0,Player-2,"Hunter",0x548,0x0,8122,"Psychic Scream",0x20,IMMUNE,nil
                8/11/2026 19:00:36.0000  SPELL_AURA_REMOVED,Player-1,"Player",0x511,0x0,Player-2,"Hunter",0x548,0x0,33206,"Pain Suppression",0x2,BUFF
                8/11/2026 19:01:03.0000  ARENA_MATCH_END,0,58
                """);

        var details = detector.detect(log).getFirst().combatDetails();
        var hunter = details.participants().stream().filter(player -> player.name().equals("Hunter")).findFirst().orElseThrow();

        assertThat(hunter.deaths()).isEqualTo(1);
        assertThat(details.timeline()).filteredOn(event -> event.eventType().equals("UNIT_DIED"))
                .singleElement().satisfies(event -> {
                    assertThat(event.target()).isEqualTo("Hunter");
                    assertThat(event.offsetSeconds()).isEqualTo(16.0);
                });
        assertThat(details.timeline()).anySatisfy(event -> {
            assertThat(event.spell()).isEqualTo("Feign Death");
            assertThat(event.eventType()).isEqualTo("SPELL_AURA_APPLIED");
        });
        assertThat(details.timeline()).anySatisfy(event -> {
            assertThat(event.spell()).isEqualTo("Psychic Scream");
            assertThat(event.eventType()).isEqualTo("SPELL_AURA_REMOVED");
            assertThat(event.offsetSeconds()).isEqualTo(22.25);
        });
        assertThat(details.timeline()).anySatisfy(event -> {
            assertThat(event.spell()).isEqualTo("Pain Suppression");
            assertThat(event.eventType()).isEqualTo("SPELL_AURA_REMOVED");
            assertThat(event.category()).isEqualTo("DEFENSIVE");
        });
        assertThat(details.timeline()).anySatisfy(event -> {
            assertThat(event.spell()).isEqualTo("Psychic Scream");
            assertThat(event.eventType()).isEqualTo("SPELL_MISSED");
            assertThat(event.category()).isEqualTo("CROWD_CONTROL");
            assertThat(event.target()).isEqualTo("Hunter");
        });
    }

    private Path testLogPath() throws URISyntaxException {
        var resource = getClass().getResource("/arena-combat-log-sample.txt");
        if (resource == null) {
            throw new IllegalStateException("Arena test combat log was not found");
        }
        return Path.of(resource.toURI());
    }
}
