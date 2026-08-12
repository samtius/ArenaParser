package com.samtius.arenaparser.controller;

import com.samtius.arenaparser.service.BattleNetCharacterClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/media")
public class BattleNetMediaController {
    private final BattleNetCharacterClient client;
    private final Map<String, String> cache = new ConcurrentHashMap<>();
    public BattleNetMediaController(BattleNetCharacterClient client) { this.client = client; }

    @GetMapping("/{type}/{id}")
    public ResponseEntity<Void> media(@PathVariable String type, @PathVariable long id,
            @RequestParam(defaultValue = "eu") String region) throws Exception {
        var normalizedRegion = region.toLowerCase();
        var key = normalizedRegion + ":" + type + ":" + id;
        var url = cache.get(key);
        if (url == null) {
            url = client.mediaUrl(normalizedRegion, type, id);
            cache.put(key, url);
        }
        return ResponseEntity.status(302).location(URI.create(url)).build();
    }
}
