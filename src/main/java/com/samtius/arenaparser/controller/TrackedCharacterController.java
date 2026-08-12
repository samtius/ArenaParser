package com.samtius.arenaparser.controller;

import com.samtius.arenaparser.dto.CreateTrackedCharacterRequest;
import com.samtius.arenaparser.dto.TrackedCharacterResponse;
import com.samtius.arenaparser.service.TrackedCharacterService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/characters")
public class TrackedCharacterController {
    private final TrackedCharacterService service;
    public TrackedCharacterController(TrackedCharacterService service) { this.service = service; }

    @GetMapping public List<TrackedCharacterResponse> findAll() { return service.findAll(); }
    @GetMapping("/status") public Map<String, Boolean> status() { return Map.of("battleNetConfigured", service.battleNetConfigured()); }
    @PostMapping public TrackedCharacterResponse create(@Valid @RequestBody CreateTrackedCharacterRequest request) { return service.create(request); }
    @PostMapping("/{id}/refresh") public TrackedCharacterResponse refresh(@PathVariable long id) { return service.refresh(id); }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable long id) { service.delete(id); return ResponseEntity.noContent().build(); }
}
