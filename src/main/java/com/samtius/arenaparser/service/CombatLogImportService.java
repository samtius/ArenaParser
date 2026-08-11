package com.samtius.arenaparser.service;

import com.samtius.arenaparser.dto.DamageSummaryResponse;
import com.samtius.arenaparser.parser.ArenaMatchDetector;
import com.samtius.arenaparser.parser.CombatLogParser;
import com.samtius.arenaparser.parser.DetectedArenaMatch;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Files;
import java.util.Comparator;
import java.util.List;

@Service
public class CombatLogImportService {

    private final CombatLogParser combatLogParser;
    private final ArenaMatchDetector arenaMatchDetector;
    private final Path combatLogPath;

    public CombatLogImportService(
            CombatLogParser combatLogParser,
            ArenaMatchDetector arenaMatchDetector,
            @Value("${arenaparser.combat-log-path:}") String combatLogPath
    ) {
        this.combatLogParser = combatLogParser;
        this.arenaMatchDetector = arenaMatchDetector;
        this.combatLogPath = combatLogPath.isBlank() ? null : Path.of(combatLogPath);
    }

    public DamageSummaryResponse readDamageSummary() throws IOException {
        var events = combatLogParser.parseDamageEvents(resolveCombatLogPath());
        var totals = combatLogParser.totalDamageBySource(events);
        return new DamageSummaryResponse(events.size(), totals);
    }

    public List<DetectedArenaMatch> detectArenaMatches() throws IOException {
        return arenaMatchDetector.detect(resolveCombatLogPath());
    }

    private Path resolveCombatLogPath() throws IOException {
        if (combatLogPath == null) {
            throw new IllegalStateException("Combat log path has not been configured");
        }
        if (!Files.isDirectory(combatLogPath)) {
            return combatLogPath;
        }

        try (var files = Files.list(combatLogPath)) {
            return files
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().startsWith("WoWCombatLog"))
                    .filter(path -> path.getFileName().toString().endsWith(".txt"))
                    .max(Comparator.comparingLong(this::lastModified))
                    .orElseThrow(() -> new IllegalStateException(
                            "No WoW combat log was found in the configured directory"
                    ));
        }
    }

    private long lastModified(Path path) {
        try {
            return Files.getLastModifiedTime(path).toMillis();
        } catch (IOException exception) {
            return Long.MIN_VALUE;
        }
    }
}
