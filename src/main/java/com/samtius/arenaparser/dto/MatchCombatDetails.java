package com.samtius.arenaparser.dto;

import java.util.List;
import com.samtius.arenaparser.model.MatchResult;

public record MatchCombatDetails(
        List<Participant> participants,
        List<KeyEvent> keyEvents,
        List<RoundDetails> rounds
) {
    public static MatchCombatDetails empty() {
        return new MatchCombatDetails(List.of(), List.of(), List.of());
    }

    public record Participant(
            String guid,
            String name,
            String className,
            String specializationName,
            Integer team,
            long damage,
            long healing,
            long absorbs,
            long damageTaken,
            int kills,
            int deaths,
            int interrupts,
            int dispels,
            List<SpellStatistic> spells,
            List<UtilityAction> interruptDetails,
            List<UtilityAction> dispelDetails,
            List<DeathRecap> deathRecaps
    ) {
    }

    public record SpellStatistic(
            long spellId,
            String name,
            long damage,
            long healing,
            long absorbs,
            long damageTaken,
            int casts,
            int hits,
            int criticals,
            long overhealing
    ) {
    }

    public record UtilityAction(
            int offsetSeconds,
            String spell,
            String target,
            String affectedSpell
    ) {
    }

    public record DeathRecap(
            int deathNumber,
            int offsetSeconds,
            List<ReceivedEvent> receivedEvents
    ) {
    }

    public record ReceivedEvent(
            double secondsBeforeDeath,
            String type,
            String source,
            String spell,
            long amount,
            long healthAfter,
            long maxHealth
    ) {
    }

    public record KeyEvent(
            int offsetSeconds,
            String type,
            String source,
            String target,
            String spell
    ) {
    }

    public record RoundDetails(
            int roundNumber,
            int durationSeconds,
            Integer playerTeam,
            Integer winningTeam,
            MatchResult result,
            List<Participant> participants
    ) {
    }
}
