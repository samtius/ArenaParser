package com.samtius.arenaparser.service;

import com.samtius.arenaparser.dto.CreateArenaMatchRequest;
import com.samtius.arenaparser.model.ArenaMatch;
import com.samtius.arenaparser.repository.ArenaMatchRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ArenaMatchService {

    private final ArenaMatchRepository arenaMatchRepository;

    public ArenaMatchService(ArenaMatchRepository arenaMatchRepository) {
        this.arenaMatchRepository = arenaMatchRepository;
    }

    public List<ArenaMatch> findAll() {
        return arenaMatchRepository.findAll();
    }

    public Optional<ArenaMatch> findById(long id) {
        return arenaMatchRepository.findById(id);
    }

    public ArenaMatch create(CreateArenaMatchRequest request) {
        var match = new ArenaMatch();
        match.setArena(request.arena());
        match.setStartedAt(request.startedAt());
        match.setDurationSeconds(request.durationSeconds());
        match.setResult(request.result());

        return arenaMatchRepository.save(match);
    }
}
