package com.samtius.arenaparser.controller;

import com.samtius.arenaparser.service.BattleNetCharacterClient;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/talent-trees")
public class TalentTreeController {
    private final BattleNetCharacterClient client;
    private final Map<String, JsonNode> cache = new ConcurrentHashMap<>();
    public TalentTreeController(BattleNetCharacterClient client) { this.client = client; }

    @GetMapping("/{treeId}/specializations/{specializationId}")
    public JsonNode tree(@PathVariable long treeId, @PathVariable long specializationId,
            @RequestParam(defaultValue = "eu") String region) throws Exception {
        var normalizedRegion = region.toLowerCase();
        var key = normalizedRegion + ":" + treeId + ":" + specializationId;
        var existing = cache.get(key);
        if (existing != null) return existing;
        var tree = client.talentTree(normalizedRegion, treeId, specializationId);
        cache.put(key, tree);
        return tree;
    }
}
