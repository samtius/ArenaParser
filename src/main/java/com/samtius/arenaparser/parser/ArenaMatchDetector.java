package com.samtius.arenaparser.parser;

import com.samtius.arenaparser.dto.MatchCombatDetails;
import com.samtius.arenaparser.model.MatchResult;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoField;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class ArenaMatchDetector {

    private static final DateTimeFormatter TIMESTAMP = new DateTimeFormatterBuilder()
            .appendPattern("M/d/yyyy HH:mm:ss")
            .appendFraction(ChronoField.NANO_OF_SECOND, 1, 9, true)
            .toFormatter();

    private final CombatLogParser combatLogParser;

    public ArenaMatchDetector(CombatLogParser combatLogParser) {
        this.combatLogParser = combatLogParser;
    }

    public List<DetectedArenaMatch> detect(Path combatLogPath) throws IOException {
        var detectedMatches = new ArrayList<DetectedArenaMatch>();
        var currentZone = "Unknown Arena";
        ArenaStart activeMatch = null;
        MatchAccumulator accumulator = null;
        ShuffleState shuffle = null;

        try (var lines = Files.lines(combatLogPath)) {
            for (var iterator = lines.iterator(); iterator.hasNext();) {
                var parsedLine = combatLogParser.parseLine(iterator.next());
                if (parsedLine.isEmpty()) continue;

                var line = parsedLine.get();
                var fields = line.fields();

                if ("ZONE_CHANGE".equals(line.eventType()) && fields.size() > 2) {
                    currentZone = fields.get(2);
                } else if ("ARENA_MATCH_START".equals(line.eventType()) && fields.size() > 3) {
                    var nextMatch = new ArenaStart(
                            currentZone,
                            parseInteger(fields.get(1)),
                            fields.get(3),
                            fields.size() > 4 ? parseInteger(fields.get(4)) : -1,
                            line.timestamp()
                    );
                    if (nextMatch.matchType().contains("Solo Shuffle")) {
                        if (shuffle == null) shuffle = new ShuffleState(nextMatch);
                        else if (activeMatch != null && accumulator != null) shuffle.addRound(activeMatch, accumulator, line.timestamp());
                    }
                    activeMatch = nextMatch;
                    accumulator = new MatchAccumulator(activeMatch);
                } else if ("ARENA_MATCH_END".equals(line.eventType()) && fields.size() > 2 && activeMatch != null) {
                    if (shuffle != null) {
                        shuffle.addRound(activeMatch, accumulator, line.timestamp());
                        detectedMatches.add(shuffle.toDetectedMatch(line.timestamp()));
                        shuffle = null;
                        activeMatch = null;
                        accumulator = null;
                        continue;
                    }
                    var winningTeam = parseInteger(fields.get(1));
                    var detectedPlayerTeam = accumulator == null || accumulator.playerTeam() == null
                            ? activeMatch.playerTeam()
                            : accumulator.playerTeam();
                    detectedMatches.add(new DetectedArenaMatch(
                            activeMatch.arena(), activeMatch.instanceId(), activeMatch.matchType(),
                            activeMatch.timestamp(), line.timestamp(), detectedPlayerTeam, winningTeam,
                            parseInteger(fields.get(2)), determineResult(detectedPlayerTeam, winningTeam),
                            accumulator == null ? MatchCombatDetails.empty() : accumulator.toDetails(),
                            null, null
                    ));
                    activeMatch = null;
                    accumulator = null;
                } else if (accumulator != null) {
                    accumulator.accept(line);
                }
            }
        }
        return detectedMatches;
    }

    private MatchResult determineResult(int playerTeam, int winningTeam) {
        if (playerTeam < 0 || winningTeam < 0) return MatchResult.UNKNOWN;
        return playerTeam == winningTeam ? MatchResult.WIN : MatchResult.LOSS;
    }

    private int parseInteger(String value) {
        try { return Integer.parseInt(value); } catch (RuntimeException exception) { return 0; }
    }

    private static long parseLong(List<String> fields, int basicIndex, int advancedIndex) {
        for (var index : new int[]{advancedIndex, basicIndex}) {
            if (index >= 0 && index < fields.size()) {
                try { return Long.parseLong(fields.get(index)); } catch (RuntimeException ignored) { }
            }
        }
        return 0;
    }

    private record ArenaStart(String arena, int instanceId, String matchType, int playerTeam, String timestamp) { }

    private static final class ShuffleState {
        private final ArenaStart firstRound;
        private final List<MatchCombatDetails.RoundDetails> rounds = new ArrayList<>();

        private ShuffleState(ArenaStart firstRound) { this.firstRound = firstRound; }

        private void addRound(ArenaStart round, MatchAccumulator accumulator, String boundaryTimestamp) {
            if (accumulator == null) return;
            var playerTeam = accumulator.playerTeam();
            var deadTeam = accumulator.deadTeam();
            Integer winningTeam = deadTeam == null ? null : deadTeam == 0 ? 1 : 0;
            var result = playerTeam == null || winningTeam == null
                    ? MatchResult.UNKNOWN
                    : playerTeam.equals(winningTeam) ? MatchResult.WIN : MatchResult.LOSS;
            rounds.add(new MatchCombatDetails.RoundDetails(
                    rounds.size() + 1,
                    durationSeconds(round.timestamp(), accumulator.lastDeathTimestamp == null ? boundaryTimestamp : accumulator.lastDeathTimestamp),
                    playerTeam, winningTeam, result, accumulator.toDetails().participants()
            ));
        }

        private DetectedArenaMatch toDetectedMatch(String endTimestamp) {
            var wins = (int) rounds.stream().filter(round -> round.result() == MatchResult.WIN).count();
            var losses = rounds.size() - wins;
            var result = wins >= 4 ? MatchResult.WIN : wins == 3 ? MatchResult.DRAW : MatchResult.LOSS;
            return new DetectedArenaMatch(
                    firstRound.arena(), firstRound.instanceId(), firstRound.matchType(), firstRound.timestamp(), endTimestamp,
                    -1, -1, durationSeconds(firstRound.timestamp(), endTimestamp), result,
                    new MatchCombatDetails(List.of(), List.of(), List.copyOf(rounds)), wins, losses
            );
        }
    }

    private static int durationSeconds(String start, String end) {
        try { return Math.max(0, (int) Duration.between(LocalDateTime.parse(start, TIMESTAMP), LocalDateTime.parse(end, TIMESTAMP)).toSeconds()); }
        catch (RuntimeException exception) { return 0; }
    }

    private static final class MatchAccumulator {
        private final ArenaStart match;
        private final Map<String, ParticipantBuilder> participants = new LinkedHashMap<>();
        private final List<MatchCombatDetails.KeyEvent> events = new ArrayList<>();
        private String ownPlayerGuid;
        private String lastDeadGuid;
        private String lastDeathTimestamp;

        private MatchAccumulator(ArenaStart match) { this.match = match; }

        private void accept(CombatLogLine line) {
            var fields = line.fields();
            var source = player(fields, 1, 2, 3);
            var target = player(fields, 5, 6, 7);
            var spellId = parseLong(fields, 9, 9);
            var spellName = value(fields, 10);

            switch (line.eventType()) {
                case "COMBATANT_INFO" -> {
                    if (source != null) {
                        source.team = (int) parseLong(fields, 2, 2);
                    }
                    if (source != null && fields.size() > 25) {
                        var specId = (int) parseLong(fields, 25, 25);
                        source.className = classForSpec(specId);
                        source.specializationName = specializationName(specId);
                    }
                }
                case "SPELL_DAMAGE", "SPELL_PERIODIC_DAMAGE" -> {
                    var amount = parseLong(fields, 12, 31);
                    if (source != null) source.addDamage(spellId, spellName, amount, bool(fields, 38));
                    if (target != null) target.addDamageTaken(spellId, spellName, amount, source, line.timestamp(), parseLong(fields, 14, 14), parseLong(fields, 15, 15));
                    var overkill = parseLong(fields, 13, 33);
                    if (overkill > 0 && source != null && target != null) {
                        source.kills++;
                    }
                }
                case "SWING_DAMAGE_LANDED" -> {
                    var amount = parseLong(fields, 9, 28);
                    if (source != null) source.addDamage(0, "Melee", amount, bool(fields, 34));
                    if (target != null) target.addDamageTaken(0, "Melee", amount, source, line.timestamp(), parseLong(fields, 11, 11), parseLong(fields, 12, 12));
                }
                case "SPELL_HEAL", "SPELL_PERIODIC_HEAL" -> {
                    var amount = parseLong(fields, 12, 31);
                    var overhealing = parseLong(fields, 13, 33);
                    var effectiveHealing = Math.max(0, amount - overhealing);
                    if (source != null) source.addHealing(spellId, spellName, amount, overhealing, bool(fields, 35));
                    if (target != null) target.addIncoming("HEALING", spellName, effectiveHealing, source, line.timestamp(), parseLong(fields, 14, 14), parseLong(fields, 15, 15));
                }
                case "SPELL_ABSORBED" -> {
                    var absorber = player(fields, 9, 10, 11);
                    var absorbSpellId = parseLong(fields, 13, 13);
                    var absorbSpellName = value(fields, 14);
                    var amount = parseLong(fields, 16, 17);
                    if (absorber != null) absorber.addAbsorb(absorbSpellId, absorbSpellName == null ? "Absorb" : absorbSpellName, amount);
                }
                case "SPELL_CAST_SUCCESS" -> { if (source != null) source.addCast(spellId, spellName); }
                case "SPELL_INTERRUPT" -> {
                    if (source != null) source.addInterrupt(new MatchCombatDetails.UtilityAction(
                            offsetSeconds(line.timestamp()), spellName, target == null ? null : target.name, value(fields, 13)
                    ));
                }
                case "SPELL_DISPEL" -> {
                    if (source != null) source.addDispel(new MatchCombatDetails.UtilityAction(
                            offsetSeconds(line.timestamp()), spellName, target == null ? null : target.name, value(fields, 13)
                    ));
                }
                case "UNIT_DIED" -> {
                    if (target != null) {
                        lastDeadGuid = target.guid;
                        lastDeathTimestamp = line.timestamp();
                        target.markDeath(line.timestamp(), match.timestamp());
                    }
                }
                default -> { }
            }
        }

        private ParticipantBuilder player(List<String> fields, int guidIndex, int nameIndex, int flagsIndex) {
            var guid = value(fields, guidIndex);
            if (guid == null || !guid.startsWith("Player-")) return null;
            var participant = participants.computeIfAbsent(guid, ignored -> new ParticipantBuilder(guid));
            var name = value(fields, nameIndex);
            if (name != null) participant.name = name;
            var flagsValue = value(fields, flagsIndex);
            var detectedTeam = team(flagsValue);
            if (detectedTeam != null && participant.team == null) participant.team = detectedTeam;
            if (isAffiliationMine(flagsValue)) ownPlayerGuid = guid;
            return participant;
        }

        private boolean isAffiliationMine(String flagsValue) {
            if (flagsValue == null || !flagsValue.startsWith("0x")) return false;
            try { return (Long.decode(flagsValue) & 0x1) != 0; }
            catch (NumberFormatException ignored) { return false; }
        }

        private Integer playerTeam() {
            var player = participants.get(ownPlayerGuid);
            return player == null ? null : player.team;
        }

        private Integer deadTeam() {
            var player = participants.get(lastDeadGuid);
            return player == null ? null : player.team;
        }

        private Integer team(String flagsValue) {
            if (flagsValue == null) return null;
            try {
                var flags = Long.decode(flagsValue);
                if ((flags & 0x10) != 0) return match.playerTeam();
                if ((flags & 0x40) != 0) return match.playerTeam() == 0 ? 1 : 0;
            } catch (NumberFormatException ignored) { }
            return null;
        }

        private MatchCombatDetails.KeyEvent event(String timestamp, String type, ParticipantBuilder source, ParticipantBuilder target, String spell) {
            int offset;
            try { offset = (int) Duration.between(LocalDateTime.parse(match.timestamp(), TIMESTAMP), LocalDateTime.parse(timestamp, TIMESTAMP)).toSeconds(); }
            catch (RuntimeException exception) { offset = 0; }
            return new MatchCombatDetails.KeyEvent(offset, type, source == null ? null : source.name, target == null ? null : target.name, spell);
        }

        private int offsetSeconds(String timestamp) {
            try { return (int) Duration.between(LocalDateTime.parse(match.timestamp(), TIMESTAMP), LocalDateTime.parse(timestamp, TIMESTAMP)).toSeconds(); }
            catch (RuntimeException exception) { return 0; }
        }

        private MatchCombatDetails toDetails() {
            var participantDetails = participants.values().stream()
                    .sorted(Comparator.comparing((ParticipantBuilder value) -> value.team, Comparator.nullsLast(Integer::compareTo)).thenComparing(value -> value.name))
                    .map(ParticipantBuilder::toDetails)
                    .toList();
            return new MatchCombatDetails(participantDetails, List.copyOf(events), List.of());
        }

        private static String value(List<String> fields, int index) { return index < fields.size() ? fields.get(index) : null; }
        private static boolean bool(List<String> fields, int index) { return "1".equals(value(fields, index)) || "true".equalsIgnoreCase(value(fields, index)); }
    }

    private static String classForSpec(int specId) {
        return switch (specId) {
            case 250, 251, 252 -> "Death Knight";
            case 577, 581, 1480 -> "Demon Hunter";
            case 102, 103, 104, 105 -> "Druid";
            case 1467, 1468, 1473 -> "Evoker";
            case 253, 254, 255 -> "Hunter";
            case 62, 63, 64 -> "Mage";
            case 268, 269, 270 -> "Monk";
            case 65, 66, 70 -> "Paladin";
            case 256, 257, 258 -> "Priest";
            case 259, 260, 261 -> "Rogue";
            case 262, 263, 264 -> "Shaman";
            case 265, 266, 267 -> "Warlock";
            case 71, 72, 73 -> "Warrior";
            default -> "Unknown class";
        };
    }

    private static String specializationName(int specId) {
        return switch (specId) {
            case 250 -> "Blood"; case 251 -> "Frost"; case 252 -> "Unholy";
            case 577 -> "Havoc"; case 581 -> "Vengeance"; case 1480 -> "Devourer";
            case 102 -> "Balance"; case 103 -> "Feral"; case 104 -> "Guardian"; case 105 -> "Restoration";
            case 1467 -> "Devastation"; case 1468 -> "Preservation"; case 1473 -> "Augmentation";
            case 253 -> "Beast Mastery"; case 254 -> "Marksmanship"; case 255 -> "Survival";
            case 62 -> "Arcane"; case 63 -> "Fire"; case 64 -> "Frost";
            case 268 -> "Brewmaster"; case 269 -> "Windwalker"; case 270 -> "Mistweaver";
            case 65 -> "Holy"; case 66 -> "Protection"; case 70 -> "Retribution";
            case 256 -> "Discipline"; case 257 -> "Holy"; case 258 -> "Shadow";
            case 259 -> "Assassination"; case 260 -> "Outlaw"; case 261 -> "Subtlety";
            case 262 -> "Elemental"; case 263 -> "Enhancement"; case 264 -> "Restoration";
            case 265 -> "Affliction"; case 266 -> "Demonology"; case 267 -> "Destruction";
            case 71 -> "Arms"; case 72 -> "Fury"; case 73 -> "Protection";
            default -> "Unknown specialization";
        };
    }

    private static final class ParticipantBuilder {
        private final String guid;
        private String name = "Unknown player";
        private String className = "Unknown class";
        private String specializationName = "Unknown specialization";
        private Integer team;
        private long damage;
        private long healing;
        private long absorbs;
        private long damageTaken;
        private int kills;
        private int deaths;
        private int interrupts;
        private int dispels;
        private final Map<Long, SpellBuilder> spells = new LinkedHashMap<>();
        private final List<MatchCombatDetails.UtilityAction> interruptDetails = new ArrayList<>();
        private final List<MatchCombatDetails.UtilityAction> dispelDetails = new ArrayList<>();
        private final List<IncomingEvent> incomingEvents = new ArrayList<>();
        private final List<MatchCombatDetails.DeathRecap> deathRecaps = new ArrayList<>();

        private ParticipantBuilder(String guid) { this.guid = guid; }
        private SpellBuilder spell(long id, String name) { return spells.computeIfAbsent(id, ignored -> new SpellBuilder(id, name == null ? "Unknown spell" : name)); }
        private void addDamage(long id, String name, long amount, boolean critical) { damage += amount; var value = spell(id, name); value.damage += amount; value.hits++; if (critical) value.criticals++; }
        private void addHealing(long id, String name, long amount, long overhealing, boolean critical) { healing += Math.max(0, amount - overhealing); var value = spell(id, name); value.healing += Math.max(0, amount - overhealing); value.overhealing += overhealing; value.hits++; if (critical) value.criticals++; }
        private void addAbsorb(long id, String name, long amount) { absorbs += amount; spell(id, name).absorbs += amount; }
        private void addDamageTaken(long id, String name, long amount, ParticipantBuilder source, String timestamp, long healthAfter, long maxHealth) { damageTaken += amount; spell(id, name).damageTaken += amount; addIncoming("DAMAGE", name, amount, source, timestamp, healthAfter, maxHealth); }
        private void addIncoming(String type, String spell, long amount, ParticipantBuilder source, String timestamp, long healthAfter, long maxHealth) { if (amount > 0) incomingEvents.add(new IncomingEvent(parseTime(timestamp), type, source == null ? null : source.name, spell, amount, healthAfter, maxHealth)); }
        private void addCast(long id, String name) { spell(id, name).casts++; }
        private void addInterrupt(MatchCombatDetails.UtilityAction action) { interrupts++; interruptDetails.add(action); }
        private void addDispel(MatchCombatDetails.UtilityAction action) { dispels++; dispelDetails.add(action); }
        private void markDeath(String timestamp, String matchStart) {
            deaths++;
            var deathTime = parseTime(timestamp);
            var windowStart = deathTime.minusSeconds(2);
            var recapEvents = incomingEvents.stream()
                    .filter(event -> !event.timestamp().isBefore(windowStart) && !event.timestamp().isAfter(deathTime))
                    .map(event -> new MatchCombatDetails.ReceivedEvent(
                            Duration.between(event.timestamp(), deathTime).toMillis() / 1000.0,
                            event.type(), event.source(), event.spell(), event.amount(), event.healthAfter(), event.maxHealth()
                    ))
                    .toList();
            int offset;
            try { offset = (int) Duration.between(parseTime(matchStart), deathTime).toSeconds(); } catch (RuntimeException exception) { offset = 0; }
            deathRecaps.add(new MatchCombatDetails.DeathRecap(deaths, offset, recapEvents));
        }
        private LocalDateTime parseTime(String timestamp) { return LocalDateTime.parse(timestamp, TIMESTAMP); }
        private MatchCombatDetails.Participant toDetails() {
            var spellDetails = spells.values().stream().sorted(Comparator.comparingLong(SpellBuilder::total).reversed()).map(SpellBuilder::toDetails).toList();
            return new MatchCombatDetails.Participant(guid, name, className, specializationName, team, damage, healing, absorbs, damageTaken, kills, deaths, interrupts, dispels, spellDetails, List.copyOf(interruptDetails), List.copyOf(dispelDetails), List.copyOf(deathRecaps));
        }
    }

    private record IncomingEvent(LocalDateTime timestamp, String type, String source, String spell, long amount, long healthAfter, long maxHealth) { }

    private static final class SpellBuilder {
        private final long id; private final String name;
        private long damage; private long healing; private long absorbs; private long damageTaken; private int casts; private int hits; private int criticals; private long overhealing;
        private SpellBuilder(long id, String name) { this.id = id; this.name = name; }
        private long total() { return damage + healing + absorbs + damageTaken; }
        private MatchCombatDetails.SpellStatistic toDetails() { return new MatchCombatDetails.SpellStatistic(id, name, damage, healing, absorbs, damageTaken, casts, hits, criticals, overhealing); }
    }
}
