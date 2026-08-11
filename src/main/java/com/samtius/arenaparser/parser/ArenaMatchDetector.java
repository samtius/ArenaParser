package com.samtius.arenaparser.parser;

import com.samtius.arenaparser.model.MatchResult;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@Component
public class ArenaMatchDetector {

    private final CombatLogParser combatLogParser;

    public ArenaMatchDetector(CombatLogParser combatLogParser) {
        this.combatLogParser = combatLogParser;
    }

    public List<DetectedArenaMatch> detect(Path combatLogPath) throws IOException {
        var detectedMatches = new ArrayList<DetectedArenaMatch>();
        var currentZone = "Unknown Arena";
        ArenaStart activeMatch = null;

        try (var lines = Files.lines(combatLogPath)) {
            for (var iterator = lines.iterator(); iterator.hasNext();) {
                var parsedLine = combatLogParser.parseLine(iterator.next());
                if (parsedLine.isEmpty()) {
                    continue;
                }

                var line = parsedLine.get();
                var fields = line.fields();

                if ("ZONE_CHANGE".equals(line.eventType()) && fields.size() > 2) {
                    currentZone = fields.get(2);
                } else if ("ARENA_MATCH_START".equals(line.eventType()) && fields.size() > 3) {
                    activeMatch = new ArenaStart(
                            currentZone,
                            parseInteger(fields.get(1)),
                            fields.get(3),
                            fields.size() > 4 ? parseInteger(fields.get(4)) : -1,
                            line.timestamp()
                    );
                } else if ("ARENA_MATCH_END".equals(line.eventType())
                        && fields.size() > 2
                        && activeMatch != null) {
                    var winningTeam = parseInteger(fields.get(1));
                    detectedMatches.add(new DetectedArenaMatch(
                            activeMatch.arena(),
                            activeMatch.instanceId(),
                            activeMatch.matchType(),
                            activeMatch.timestamp(),
                            line.timestamp(),
                            activeMatch.playerTeam(),
                            winningTeam,
                            parseInteger(fields.get(2)),
                            determineResult(activeMatch.playerTeam(), winningTeam)
                    ));
                    activeMatch = null;
                }
            }
        }

        return detectedMatches;
    }

    private MatchResult determineResult(int playerTeam, int winningTeam) {
        if (playerTeam < 0 || winningTeam < 0) {
            return MatchResult.UNKNOWN;
        }
        return playerTeam == winningTeam ? MatchResult.WIN : MatchResult.LOSS;
    }

    private int parseInteger(String value) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private record ArenaStart(
            String arena,
            int instanceId,
            String matchType,
            int playerTeam,
            String timestamp
    ) {
    }
}
