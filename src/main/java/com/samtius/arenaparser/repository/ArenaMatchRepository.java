package com.samtius.arenaparser.repository;

import com.samtius.arenaparser.model.ArenaMatch;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ArenaMatchRepository extends JpaRepository<ArenaMatch, Long> {

    boolean existsBySourceKey(String sourceKey);
}
