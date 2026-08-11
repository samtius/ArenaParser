package com.samtius.arenaparser.parser;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

@Component
public class CombatLogParser {

    private static final Pattern LOG_LINE = Pattern.compile(
            "^(?<timestamp>\\d{1,2}/\\d{1,2}(?:/\\d{4})?\\s+\\d{2}:\\d{2}:\\d{2}\\.\\d+)\\s{2}(?<event>.+)$"
    );

    public List<SpellDamageEvent> parseDamageEvents(Path combatLogPath) throws IOException {
        try (var lines = Files.lines(combatLogPath)) {
            return lines.map(this::parseDamageEvent)
                    .flatMap(Optional::stream)
                    .toList();
        }
    }

    public Optional<SpellDamageEvent> parseDamageEvent(String line) {
        var parsedLine = parseLine(line);
        if (parsedLine.isEmpty()) {
            return Optional.empty();
        }

        var combatLogLine = parsedLine.get();
        var fields = combatLogLine.fields();
        if (fields.size() < 13 || !"SPELL_DAMAGE".equals(combatLogLine.eventType())) {
            return Optional.empty();
        }

        try {
            return Optional.of(new SpellDamageEvent(
                    combatLogLine.timestamp(),
                    fields.get(1),
                    fields.get(2),
                    fields.get(5),
                    fields.get(6),
                    Integer.parseInt(fields.get(9)),
                    fields.get(10),
                    parseDamageAmount(fields)
            ));
        } catch (NumberFormatException exception) {
            return Optional.empty();
        }
    }

    public Optional<CombatLogLine> parseLine(String line) {
        var matcher = LOG_LINE.matcher(line);
        if (!matcher.matches()) {
            return Optional.empty();
        }

        var fields = splitCombatLogFields(matcher.group("event"));
        if (fields.isEmpty() || fields.getFirst() == null) {
            return Optional.empty();
        }

        return Optional.of(new CombatLogLine(
                matcher.group("timestamp"),
                fields.getFirst(),
                Collections.unmodifiableList(new ArrayList<>(fields))
        ));
    }

    private long parseDamageAmount(List<String> fields) {
        try {
            // Basic combat logs place the amount directly after spell school.
            return Long.parseLong(fields.get(12));
        } catch (NumberFormatException ignored) {
            // Advanced logs insert destination state and position data first.
            if (fields.size() <= 31) {
                throw ignored;
            }
            return Long.parseLong(fields.get(31));
        }
    }

    public Map<String, Long> totalDamageBySource(List<SpellDamageEvent> events) {
        var totals = new LinkedHashMap<String, Long>();

        for (var event : events) {
            var source = event.sourceName() == null || event.sourceName().isBlank()
                    ? event.sourceGuid()
                    : event.sourceName();
            totals.merge(source, event.amount(), Long::sum);
        }

        return totals;
    }

    private List<String> splitCombatLogFields(String value) {
        var fields = new ArrayList<String>();
        var current = new StringBuilder();
        var insideQuotes = false;

        for (int index = 0; index < value.length(); index++) {
            var character = value.charAt(index);

            if (character == '"') {
                insideQuotes = !insideQuotes;
            } else if (character == ',' && !insideQuotes) {
                fields.add(normalizeField(current.toString()));
                current.setLength(0);
            } else {
                current.append(character);
            }
        }

        fields.add(normalizeField(current.toString()));
        return fields;
    }

    private String normalizeField(String value) {
        var normalized = value.trim();
        return "nil".equals(normalized) ? null : normalized;
    }
}
