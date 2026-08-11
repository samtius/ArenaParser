package com.samtius.arenaparser.controller;

import com.samtius.arenaparser.dto.CreateArenaMatchRequest;
import com.samtius.arenaparser.model.ArenaMatch;
import com.samtius.arenaparser.service.ArenaMatchService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.List;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController
@RequestMapping("/api/matches")
public class ArenaMatchController {

    private final ArenaMatchService arenaMatchService;

    public ArenaMatchController(ArenaMatchService arenaMatchService) {
        this.arenaMatchService = arenaMatchService;
    }

    @GetMapping
    public List<ArenaMatch> findAll() {
        return arenaMatchService.findAll();
    }

    @GetMapping("/{id}")
    public ArenaMatch findById(@PathVariable long id) {
        return arenaMatchService.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Arena match not found"));
    }

    @GetMapping("/{id}/details")
    public com.samtius.arenaparser.dto.MatchCombatDetails findDetails(@PathVariable long id) {
        return arenaMatchService.findCombatDetails(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Arena match not found"));
    }

    @PostMapping
    public ResponseEntity<ArenaMatch> create(@Valid @RequestBody CreateArenaMatchRequest request) {
        var createdMatch = arenaMatchService.create(request);
        var location = URI.create("/api/matches/" + createdMatch.getId());

        return ResponseEntity.created(location).body(createdMatch);
    }
}
